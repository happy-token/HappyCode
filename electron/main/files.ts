import fs from 'fs/promises'
import path from 'path'
import { createReadStream, existsSync, statSync, Dirent } from 'fs'
import { createInterface } from 'readline'
import { FileTreeNode, FilePreviewResult, FileOperationResult } from '../shared/types'
import { isPathSafe, getFileLanguage, shouldIgnoreDir } from './files-utils'

const MAX_PREVIEW_LINES = 10000
const MAX_PREVIEW_SIZE = 500 * 1024 // 500KB

// ── scanDir ──────────────────────────────────────────────────────────────

export async function scanDir(
  dirPath: string,
  cwd: string,
  depth = 0,
): Promise<FileTreeNode[]> {
  const resolved = path.resolve(cwd, dirPath)
  if (!isPathSafe(resolved, cwd)) {
    return []
  }

  let entries: Dirent[]
  try {
    entries = await fs.readdir(resolved, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileTreeNode[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && shouldIgnoreDir(entry.name)) continue

    const childPath = path.join(resolved, entry.name)
    const relative = path.relative(cwd, childPath)

    let children: FileTreeNode[] | undefined
    if (entry.isDirectory() && depth > 0) {
      try {
        children = await scanDir(childPath, cwd, depth - 1)
      } catch {
        // stat error on child — skip
      }
    }

    let size: number | undefined
    if (entry.isFile()) {
      try {
        const st = statSync(childPath)
        size = st.size
      } catch {
        // ignore
      }
    }

    nodes.push({
      name: entry.name,
      isDir: entry.isDirectory(),
      path: relative,
      size,
      children,
    })
  }

  return nodes
}

// ── previewFile ──────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export async function previewFile(
  filePath: string,
  cwd: string,
  maxLines = MAX_PREVIEW_LINES,
): Promise<FilePreviewResult> {
  const resolved = path.resolve(cwd, filePath)

  if (!isPathSafe(resolved, cwd)) {
    return { content: '', totalLines: 0, language: '', truncated: false, tooLarge: false }
  }

  if (!existsSync(resolved)) {
    return { content: '', totalLines: 0, language: '', truncated: false, tooLarge: false }
  }

  const st = statSync(resolved)
  if (st.isDirectory()) {
    return { content: '', totalLines: 0, language: '', truncated: false }
  }

  // Handle images
  const ext = getExt(resolved)
  if (IMAGE_EXTS.has(ext) && st.size <= MAX_PREVIEW_SIZE * 10) {
    const buffer = await fs.readFile(resolved)
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
    return {
      content: `data:${mimeType};base64,${buffer.toString('base64')}`,
      totalLines: 0,
      language: ext,
      truncated: false,
      isImage: true,
      mimeType,
    }
  }

  if (st.size > MAX_PREVIEW_SIZE * 10) {
    return {
      content: '',
      totalLines: 0,
      language: getFileLanguage(resolved),
      truncated: false,
      tooLarge: true,
    }
  }

  const lines: string[] = []
  let totalLines = 0
  let truncated = false

  const rl = createInterface({
    input: createReadStream(resolved),
    crlfDelay: Infinity,
    terminal: false,
  })

  for await (const line of rl) {
    totalLines++
    if (lines.length < maxLines) {
      lines.push(line)
    } else if (!truncated) {
      truncated = true
    }
  }

  return {
    content: lines.join('\n'),
    totalLines,
    language: getFileLanguage(resolved),
    truncated,
  }
}

// ── searchFiles ──────────────────────────────────────────────────────────

export async function searchFiles(
  dirPath: string,
  cwd: string,
  query: string,
): Promise<string[]> {
  const resolved = path.resolve(cwd, dirPath)
  if (!isPathSafe(resolved, cwd)) {
    return []
  }

  const lowerQuery = query.toLowerCase()
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.isDirectory() && shouldIgnoreDir(entry.name)) continue

      const childPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(childPath)
      } else if (entry.name.toLowerCase().includes(lowerQuery)) {
        const relative = path.relative(cwd, childPath)
        results.push(relative)
      }
    }
  }

  await walk(resolved)
  return results
}

// ── createFile ───────────────────────────────────────────────────────────

export async function createFile(
  filePath: string,
  cwd: string,
  content = '',
): Promise<FileOperationResult> {
  const resolved = path.resolve(cwd, filePath)

  if (!isPathSafe(resolved, cwd)) {
    return { success: false, error: 'Path is outside the working directory' }
  }

  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, content, 'utf-8')
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── deleteFile ───────────────────────────────────────────────────────────

export async function deleteFile(
  filePath: string,
  cwd: string,
): Promise<FileOperationResult> {
  const resolved = path.resolve(cwd, filePath)

  if (!isPathSafe(resolved, cwd)) {
    return { success: false, error: 'Path is outside the working directory' }
  }

  try {
    const st = statSync(resolved)
    if (!st.isFile()) throw new Error('Not a file')
    await fs.unlink(resolved)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── renameFile ───────────────────────────────────────────────────────────

export async function renameFile(
  oldPath: string,
  newPath: string,
  cwd: string,
): Promise<FileOperationResult> {
  const resolvedOld = path.resolve(cwd, oldPath)
  const resolvedNew = path.resolve(cwd, newPath)

  if (!isPathSafe(resolvedOld, cwd)) {
    return { success: false, error: 'Source path is outside the working directory' }
  }
  if (!isPathSafe(resolvedNew, cwd)) {
    return { success: false, error: 'Destination path is outside the working directory' }
  }

  try {
    await fs.mkdir(path.dirname(resolvedNew), { recursive: true })
    await fs.rename(resolvedOld, resolvedNew)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
