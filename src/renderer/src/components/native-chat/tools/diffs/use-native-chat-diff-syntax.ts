import { useMemo } from 'react'
import { useHighlightedSyntax } from '@/hooks/use-highlighted-syntax'
import { detectLanguage } from '../../../../../../shared/editor-language/editor-language-detect'

type DiffSyntaxRow = { kind: string; text: string }

/** Tokenize old and new text separately so removed code cannot change the new code's grammar. */
export function useNativeChatDiffSyntax(lines: readonly DiffSyntaxRow[], path?: string) {
  const prepared = useMemo(() => {
    const old: string[] = []
    const next: string[] = []
    const indices = lines.map((line) => {
      if (line.kind === 'meta' || line.kind === 'gap') {
        return null
      }
      const index = line.kind === 'del' ? old.length : next.length
      if (line.kind !== 'add') {
        old.push(line.text)
      }
      if (line.kind !== 'del') {
        next.push(line.text)
      }
      return { old: line.kind === 'del', index }
    })
    return { old: old.join('\n'), next: next.join('\n'), indices }
  }, [lines])
  const language = path ? detectLanguage(path) : 'plaintext'
  const old = useHighlightedSyntax(prepared.old, language)
  const next = useHighlightedSyntax(prepared.next, language)
  return prepared.indices.map((row) => (row ? (row.old ? old : next)?.lines[row.index] : undefined))
}
