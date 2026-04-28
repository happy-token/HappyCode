import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { scanDir, previewFile, searchFiles, createFile, deleteFile, renameFile } from '../electron/main/files'

let tmpDir: string

async function setupTree(): Promise<void> {
  // tmpDir/
  //   src/
  //     index.ts
  //     utils/
  //       helper.ts
  //   docs/
  //     README.md
  //   package.json
  //   node_modules/
  //     lodash/
  //       index.js   (should be ignored)
  await fs.mkdir(path.join(tmpDir, 'src', 'utils'), { recursive: true })
  await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true })
  await fs.mkdir(path.join(tmpDir, 'node_modules', 'lodash'), { recursive: true })
  await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), 'export const app = "hello"\n')
  await fs.writeFile(path.join(tmpDir, 'src', 'utils', 'helper.ts'), 'export function helper() {}\n')
  await fs.writeFile(path.join(tmpDir, 'docs', 'README.md'), '# Docs\n')
  await fs.writeFile(path.join(tmpDir, 'package.json'), '{"name":"test"}\n')
  await fs.writeFile(path.join(tmpDir, 'node_modules', 'lodash', 'index.js'), 'module.exports = {}\n')
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'happycode-files-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── scanDir ──────────────────────────────────────────────────────────────

describe('scanDir', () => {
  it('returns correct tree structure at depth 0', async () => {
    await setupTree()
    const tree = await scanDir(tmpDir, tmpDir, 0)
    const names = tree.map(n => n.name).sort()
    expect(names).toContain('src')
    expect(names).toContain('docs')
    expect(names).toContain('package.json')
    // node_modules should be skipped
    expect(names).not.toContain('node_modules')
    // children should not be expanded at depth 0
    const srcNode = tree.find(n => n.name === 'src')
    expect(srcNode?.children).toBeUndefined()
  })

  it('expands children at depth 1', async () => {
    await setupTree()
    const tree = await scanDir(tmpDir, tmpDir, 1)
    const srcNode = tree.find(n => n.name === 'src')
    expect(srcNode?.children).toBeDefined()
    expect(srcNode?.children?.length).toBeGreaterThan(0)
    const childNames = srcNode!.children!.map(c => c.name)
    expect(childNames).toContain('index.ts')
    expect(childNames).toContain('utils')
  })

  it('returns empty array for unsafe path', async () => {
    await setupTree()
    const result = await scanDir('/etc', tmpDir, 0)
    expect(result).toEqual([])
  })

  it('returns empty array for nonexistent directory', async () => {
    const result = await scanDir(path.join(tmpDir, 'no-such-dir'), tmpDir, 0)
    expect(result).toEqual([])
  })
})

// ── previewFile ──────────────────────────────────────────────────────────

describe('previewFile', () => {
  it('reads file content correctly', async () => {
    const filePath = path.join(tmpDir, 'hello.ts')
    await fs.writeFile(filePath, 'line1\nline2\nline3\n')
    const result = await previewFile(filePath, tmpDir)
    expect(result.content).toBe('line1\nline2\nline3')
    expect(result.totalLines).toBe(3)
    expect(result.language).toBe('typescript')
    expect(result.truncated).toBe(false)
  })

  it('truncates at MAX_PREVIEW_LINES', async () => {
    const filePath = path.join(tmpDir, 'big.ts')
    const lines = Array.from({ length: 15000 }, (_, i) => `line-${i}`)
    await fs.writeFile(filePath, lines.join('\n'))
    const result = await previewFile(filePath, tmpDir)
    expect(result.truncated).toBe(true)
    expect(result.totalLines).toBe(15000)
    const contentLines = result.content.split('\n')
    expect(contentLines.length).toBe(10000)
  })

  it('returns tooLarge for huge files', async () => {
    const filePath = path.join(tmpDir, 'huge.bin')
    // Write > 5MB (MAX_PREVIEW_SIZE * 10 = 5MB)
    const buf = Buffer.alloc(6 * 1024 * 1024, 0)
    await fs.writeFile(filePath, buf)
    const result = await previewFile(filePath, tmpDir)
    expect(result.tooLarge).toBe(true)
  })

  it('returns empty for nonexistent file', async () => {
    const result = await previewFile(path.join(tmpDir, 'missing.ts'), tmpDir)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(0)
  })

  it('returns empty for directory', async () => {
    await fs.mkdir(path.join(tmpDir, 'adir'), { recursive: true })
    const result = await previewFile(path.join(tmpDir, 'adir'), tmpDir)
    expect(result.content).toBe('')
  })

  it('rejects unsafe paths', async () => {
    const result = await previewFile('/etc/passwd', tmpDir)
    expect(result.tooLarge).toBe(false)
    expect(result.content).toBe('')
  })
})

// ── searchFiles ──────────────────────────────────────────────────────────

describe('searchFiles', () => {
  it('finds matching files case-insensitively', async () => {
    await setupTree()
    const results = await searchFiles(tmpDir, tmpDir, 'readme')
    expect(results).toContain('docs/README.md')
  })

  it('finds partial name matches', async () => {
    await setupTree()
    const results = await searchFiles(tmpDir, tmpDir, 'help')
    expect(results).toContain('src/utils/helper.ts')
  })

  it('skips ignored directories', async () => {
    await setupTree()
    const results = await searchFiles(tmpDir, tmpDir, 'index')
    // Should find src/index.ts but NOT node_modules/lodash/index.js
    expect(results).toContain('src/index.ts')
    const nodeModulesHits = results.filter(r => r.includes('node_modules'))
    expect(nodeModulesHits).toHaveLength(0)
  })

  it('returns empty for unsafe path', async () => {
    await setupTree()
    const results = await searchFiles('/etc', tmpDir, 'passwd')
    expect(results).toEqual([])
  })
})

// ── createFile ───────────────────────────────────────────────────────────

describe('createFile', () => {
  it('creates file with content', async () => {
    const result = await createFile('src/new.ts', tmpDir, 'export const x = 1\n')
    expect(result.success).toBe(true)
    const content = await fs.readFile(path.join(tmpDir, 'src', 'new.ts'), 'utf-8')
    expect(content).toBe('export const x = 1\n')
  })

  it('creates parent directories', async () => {
    const result = await createFile('deep/nested/dir/file.txt', tmpDir, 'hello')
    expect(result.success).toBe(true)
    const content = await fs.readFile(path.join(tmpDir, 'deep', 'nested', 'dir', 'file.txt'), 'utf-8')
    expect(content).toBe('hello')
  })

  it('creates file with default empty content', async () => {
    const result = await createFile('empty.txt', tmpDir)
    expect(result.success).toBe(true)
    const content = await fs.readFile(path.join(tmpDir, 'empty.txt'), 'utf-8')
    expect(content).toBe('')
  })

  it('rejects unsafe path', async () => {
    const result = await createFile('/etc/evil.txt', tmpDir, 'hack')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

// ── deleteFile ───────────────────────────────────────────────────────────

describe('deleteFile', () => {
  it('removes file', async () => {
    const filePath = path.join(tmpDir, 'delete-me.txt')
    await fs.writeFile(filePath, 'bye')
    const result = await deleteFile('delete-me.txt', tmpDir)
    expect(result.success).toBe(true)
    expect(() => {
      // verify deletion
      const st = fs.statSync(filePath)
    }).toThrow()
  })

  it('returns error for nonexistent file', async () => {
    const result = await deleteFile('does-not-exist.txt', tmpDir)
    expect(result.success).toBe(false)
  })

  it('rejects unsafe path', async () => {
    const result = await deleteFile('/etc/passwd', tmpDir)
    expect(result.success).toBe(false)
  })
})

// ── renameFile ───────────────────────────────────────────────────────────

describe('renameFile', () => {
  it('changes filename', async () => {
    const oldPath = path.join(tmpDir, 'old.txt')
    await fs.writeFile(oldPath, 'rename me')
    const result = await renameFile('old.txt', 'new.txt', tmpDir)
    expect(result.success).toBe(true)
    expect(() => fs.statSync(oldPath)).toThrow()
    const content = await fs.readFile(path.join(tmpDir, 'new.txt'), 'utf-8')
    expect(content).toBe('rename me')
  })

  it('rejects unsafe source path', async () => {
    const result = await renameFile('/etc/passwd', 'safe.txt', tmpDir)
    expect(result.success).toBe(false)
  })

  it('rejects unsafe destination path', async () => {
    const filePath = path.join(tmpDir, 'safe.txt')
    await fs.writeFile(filePath, 'ok')
    const result = await renameFile('safe.txt', '/etc/evil.txt', tmpDir)
    expect(result.success).toBe(false)
  })
})
