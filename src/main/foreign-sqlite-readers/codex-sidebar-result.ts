import { z } from 'zod'
import { CodexProjectStructureSchema } from '../../shared/ai-vault/contracts/codex-project-structure'

const Result = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ok'), structure: CodexProjectStructureSchema }),
  z.object({ kind: z.literal('unsupported') }),
  z.object({ kind: z.literal('unavailable') })
])
export type CodexSidebarResult = z.infer<typeof Result>
export const codexSidebarUnavailable = (): CodexSidebarResult => ({ kind: 'unavailable' })
export function parseCodexSidebarResult(value: unknown): CodexSidebarResult | null {
  const result = Result.safeParse(value)
  return result.success ? result.data : null
}
