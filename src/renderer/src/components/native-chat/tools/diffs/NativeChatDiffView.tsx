import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { NativeChatHighlightedLine } from '../../markdown/code/NativeChatHighlightedCode'
import { useNativeChatDiffSyntax } from './use-native-chat-diff-syntax'
import type { NativeChatDiffLine as DiffLine } from '../../../../../../shared/native-chat/tools/native-chat-diff'

function DiffChunk({ lines, path }: { lines: DiffLine[]; path?: string }): React.JSX.Element {
  const syntax = useNativeChatDiffSyntax(lines, path)
  return (
    <>
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'whitespace-pre-wrap break-words px-2',
            line.kind === 'add' && 'bg-[var(--diff-added-background)] text-chat-diff-added',
            line.kind === 'del' && 'bg-[var(--diff-removed-background)] text-chat-diff-removed',
            line.kind === 'meta' && 'text-chat-foreground-faint',
            line.kind === 'context' && 'text-chat-foreground'
          )}
        >
          {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}
          {syntax[i] ? (
            <NativeChatHighlightedLine
              line={syntax[i]}
              includeEnding={false}
              diff={line.kind === 'add' || line.kind === 'del'}
            />
          ) : (
            line.text
          )}
        </div>
      ))}
    </>
  )
}

export function NativeChatDiffView({ lines }: { lines: DiffLine[] }): React.JSX.Element {
  const chunks = useMemo(() => {
    const result: { key: string; path?: string; lines: DiffLine[] }[] = []
    let current: { path?: string; lines: DiffLine[] } = { lines: [] }
    const occurrences = new Map<string, number>()
    const flush = () => {
      const identity = current.path ?? 'preamble'
      const occurrence = occurrences.get(identity) ?? 0
      occurrences.set(identity, occurrence + 1)
      result.push({ ...current, key: `${identity}:${occurrence}` })
    }
    for (const line of lines) {
      if (line.kind === 'meta' && /^(?:---|\+\+\+) /.test(line.text)) {
        const path = line.text.slice(4).split('\t')[0]?.replace(/^"|"$/g, '')
        if (path && path !== '/dev/null') {
          if (current.lines.some((row) => row.kind !== 'meta')) {
            flush()
            current = { lines: [] }
          }
          current.path = path
        }
      }
      current.lines.push(line)
    }
    if (current.lines.length) {
      flush()
    }
    return result
  }, [lines])
  return (
    <div
      data-native-chat-code-content
      tabIndex={0}
      className="max-h-64 overflow-auto rounded-lg border border-chat-code-border bg-chat-code-surface py-1 font-mono text-chat-code leading-relaxed text-chat-foreground scrollbar-sleek focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {chunks.map((chunk) => (
        <DiffChunk key={chunk.key} lines={chunk.lines} path={chunk.path} />
      ))}
    </div>
  )
}
