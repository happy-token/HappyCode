import { execFile } from 'child_process'
import { promisify } from 'util'
import type {
  GitStatus,
  GitStatusEntry,
  GitStatusCode,
  GitLogEntry,
  GitCommitDetail,
  GitWorktree,
  GitBranch,
  GitOperationResult,
} from '../shared/types'

const execFileAsync = promisify(execFile)

const GIT_OPTIONS = {
  timeout: 10_000,
  maxBuffer: 10 * 1024 * 1024,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync('git', args, { ...GIT_OPTIONS, cwd })
  } catch (err) {
    const e = typeof err === 'object' && err !== null ? err as Record<string, unknown> : {}
    const stderr = typeof e['stderr'] === 'string' ? e['stderr'].trim() : ''
    const message = typeof e['message'] === 'string' ? e['message'] : ''
    throw new Error(stderr || message || 'git command failed')
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
    return stdout.trim() === 'true'
  } catch { return false }
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  const branchResult = await git(cwd, ['branch', '--show-current']).catch(() => ({ stdout: '', stderr: '' }))
  const branch = branchResult.stdout.trim()

  const upstreamResult = await git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}']).catch(() => ({ stdout: '', stderr: '' }))
  const upstream = upstreamResult.stdout.trim() || undefined

  let ahead = 0
  let behind = 0
  if (upstream) {
    const countResult = await git(cwd, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]).catch(() => ({ stdout: '0\t0', stderr: '' }))
    const [a, b] = countResult.stdout.trim().split('\t').map(Number)
    ahead = a || 0
    behind = b || 0
  }

  const { stdout: porcelain } = await git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal'])
  return parseGitStatus(porcelain, branch, upstream, ahead, behind)
}

export function parseGitStatus(porcelain: string, branch: string, upstream?: string, ahead = 0, behind = 0): GitStatus {
  const entries: GitStatusEntry[] = []
  const codeMap: Record<string, GitStatusCode> = {
    M: 'M', A: 'A', D: 'D', R: 'R', '?': '?', '!': '!',
  }

  for (const line of porcelain.split('\n').filter(Boolean)) {
    const xy = line.slice(0, 2)
    const file = line.slice(3).trim()
    if (!file) continue

    const x = xy[0] ?? ' '
    const y = xy[1] ?? ' '
    const staged = x !== ' ' && x !== '?'
    const raw = staged ? x : y
    const code: GitStatusCode = codeMap[raw] ?? 'M'
    entries.push({ code, staged, file })
  }

  return { branch, upstream, ahead, behind, entries }
}

export async function getBranches(cwd: string): Promise<GitBranch[]> {
  const { stdout } = await git(cwd, [
    'branch', '-a',
    '--format=%(HEAD)\t%(refname:short)\t%(upstream:short)\t%(worktreepath)',
  ])

  return stdout.split('\n').filter(Boolean).map((line) => {
    const [head, name, upstream, worktreePath] = line.split('\t')
    return {
      name: name ?? '',
      isRemote: (name ?? '').startsWith('remotes/'),
      isCurrent: head === '*',
      upstream: upstream || undefined,
      worktreePath: worktreePath || undefined,
    }
  })
}

export async function checkout(cwd: string, branch: string): Promise<GitOperationResult> {
  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return { success: false, error: `Invalid branch name: ${branch}` }
  }
  try {
    await git(cwd, ['checkout', branch])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function createBranch(cwd: string, branch: string, startPoint?: string): Promise<GitOperationResult> {
  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return { success: false, error: `Invalid branch name: ${branch}` }
  }
  try {
    const args = ['checkout', '-b', branch]
    if (startPoint) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(startPoint)) {
        return { success: false, error: `Invalid start point: ${startPoint}` }
      }
      args.push(startPoint)
    }
    await git(cwd, args)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function getLog(cwd: string, limit = 30): Promise<GitLogEntry[]> {
  const { stdout } = await git(cwd, [
    'log',
    `--pretty=format:%H%x00%h%x00%s%x00%an%x00%ai%x00%ar`,
    `-n`, String(limit),
  ])
  return parseGitLog(stdout)
}

export function parseGitLog(output: string): GitLogEntry[] {
  if (!output.trim()) return []
  return output.split('\n').filter(Boolean).map((line) => {
    const parts = line.split('\x00')
    return {
      sha: parts[0] ?? '',
      shortSha: parts[1] ?? '',
      message: parts[2] ?? '',
      author: parts[3] ?? '',
      date: parts[4] ?? '',
      relativeDate: parts[5] ?? '',
    }
  })
}

export async function commit(cwd: string, message: string): Promise<GitOperationResult> {
  try {
    await git(cwd, ['add', '-A'])
    await git(cwd, ['commit', '-m', message])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function push(cwd: string): Promise<GitOperationResult> {
  try {
    await git(cwd, ['push'])
    return { success: true }
  } catch (err) {
    try {
      const branch = await git(cwd, ['branch', '--show-current'])
      await git(cwd, ['push', '-u', 'origin', branch.stdout.trim()])
      return { success: true }
    } catch (fallbackErr) {
      return { success: false, error: String(fallbackErr) }
    }
  }
}

export async function getDiff(cwd: string, file?: string): Promise<string> {
  const args = ['diff']
  if (file) args.push('--', file)
  const { stdout } = await git(cwd, args)
  return stdout
}

export async function getCommitDetail(cwd: string, sha: string): Promise<GitCommitDetail> {
  if (!/^[0-9a-f]{4,64}$/i.test(sha)) {
    throw new Error(`Invalid SHA: ${sha}`)
  }
  const { stdout: showOutput } = await git(cwd, ['show', '--stat', '--format=%H%x00%s%x00%an%x00%ai', '--no-patch', sha])
  const firstLine = showOutput.trim().split('\n')[0] ?? ''
  const [fullSha, message, author, date] = firstLine.split('\x00')

  const { stdout: diffOutput } = await git(cwd, ['show', sha])

  const { stdout: statOutput } = await git(cwd, ['show', '--numstat', '--format=', sha])
  let added = 0
  let deleted = 0
  let files = 0
  for (const line of statOutput.trim().split('\n').filter(Boolean)) {
    const [a, d] = line.split('\t')
    if (a && a !== '-') added += parseInt(a, 10) || 0
    if (d && d !== '-') deleted += parseInt(d, 10) || 0
    files++
  }

  return {
    sha: fullSha ?? sha,
    message: message ?? '',
    author: author ?? '',
    date: date ?? '',
    stats: { added, deleted, files },
    diff: diffOutput,
  }
}

export async function getWorktrees(cwd: string): Promise<GitWorktree[]> {
  const { stdout } = await git(cwd, ['worktree', 'list', '--porcelain'])
  const worktrees: GitWorktree[] = []
  let current: Partial<GitWorktree> = {}

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current as GitWorktree)
      current = { path: line.slice(9), isDetached: false, dirty: false }
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '')
    } else if (line.startsWith('detached')) {
      current.isDetached = true
    } else if (line === 'dirty') {
      current.dirty = true
    }
  }
  if (current.path) worktrees.push(current as GitWorktree)

  return worktrees
}

export async function deriveWorktree(cwd: string, branch: string, targetPath: string): Promise<GitOperationResult> {
  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return { success: false, error: `Invalid branch name: ${branch}` }
  }
  if (!/^[a-zA-Z0-9_./ -]+$/.test(targetPath)) {
    return { success: false, error: `Invalid target path: ${targetPath}` }
  }
  try {
    await git(cwd, ['worktree', 'add', '-b', branch, targetPath])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
