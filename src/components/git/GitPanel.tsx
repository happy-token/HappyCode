import React, { useEffect, useMemo } from 'react'
import { GitBranch, History, FolderGit, GitCommit, X } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useGitStore } from '../../store/git-store'
import { useUiStore } from '../../store/ui-store'
import { GitStatusSection } from './GitStatusSection'
import { GitBranchSelector } from './GitBranchSelector'
import { GitHistorySection } from './GitHistorySection'
import { GitWorktreeSection } from './GitWorktreeSection'
import { cn } from '@renderer/lib/utils'

interface SectionDef {
  id: string
  label: string
  icon: React.JSX.Element
  content: React.JSX.Element
}

export function GitPanel(): React.JSX.Element {
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const toggleGit = useUiStore((s) => s.toggleGit)
  const loadStatus = useGitStore((s) => s.loadStatus)
  const loadLog = useGitStore((s) => s.loadLog)
  const loadBranches = useGitStore((s) => s.loadBranches)
  const loadWorktrees = useGitStore((s) => s.loadWorktrees)

  useEffect(() => {
    if (cwd) {
      void loadStatus(cwd)
      void loadLog(cwd)
      void loadBranches(cwd)
      void loadWorktrees(cwd)
    }
  }, [cwd, loadStatus, loadLog, loadBranches, loadWorktrees])

  const sections: SectionDef[] = useMemo(() => [
    { id: 'status', label: 'Status', icon: <GitCommit size={13} />, content: <GitStatusSection /> },
    { id: 'branch', label: 'Branch', icon: <GitBranch size={13} />, content: <GitBranchSelector /> },
    { id: 'history', label: 'History', icon: <History size={13} />, content: <GitHistorySection /> },
    { id: 'worktree', label: 'Worktree', icon: <FolderGit size={13} />, content: <GitWorktreeSection /> },
  ], [])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-[10px] py-[6px] border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.05em]">Git</span>
        <button className="cursor-pointer bg-transparent border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] px-[6px] py-1 flex items-center hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]" onClick={toggleGit} title="Close"><X size={13} /></button>
      </div>
      {sections.map((section) => (
        <Section key={section.id} section={section} defaultExpanded={section.id === 'status'} />
      ))}
    </div>
  )
}

function Section({ section, defaultExpanded }: { section: SectionDef; defaultExpanded: boolean }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  return (
    <div className="border-b border-[var(--color-border)]">
      <button className="flex items-center gap-[6px] w-full px-[10px] py-[7px] text-left text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] border-0 cursor-pointer transition-[background,color] duration-100 select-none hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]" onClick={() => setExpanded((v) => !v)}>
        {section.icon}
        <span className="flex-1 uppercase tracking-[0.06em] text-[10px]">{section.label}</span>
        <span className={cn('text-[9px] text-[var(--color-text-faint)] transition-transform duration-150 inline-block', expanded && 'rotate-90')}>▸</span>
      </button>
      {expanded && <div className="p-2 bg-[var(--color-bg)]">{section.content}</div>}
    </div>
  )
}
