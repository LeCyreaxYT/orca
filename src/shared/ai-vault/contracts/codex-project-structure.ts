import { z } from 'zod'

export const CodexProjectStructureSchema = z.object({
  projects: z.array(z.object({ id: z.string(), name: z.string(), paths: z.array(z.string()) })),
  assignments: z.record(z.string(), z.string()),
  pinned: z.array(z.string()),
  titles: z.record(z.string(), z.string()).optional(),
  available: z.boolean()
})
export type CodexProjectStructure = z.infer<typeof CodexProjectStructureSchema>

export const EMPTY_CODEX_PROJECT_STRUCTURE: CodexProjectStructure = {
  projects: [],
  assignments: {},
  pinned: [],
  available: false
}
