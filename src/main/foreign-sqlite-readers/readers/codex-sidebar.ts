import { z } from 'zod'
import SyncDatabase from '../../sqlite/sync-database'
import type { CodexSidebarResult } from '../codex-sidebar-result'

const Roots = z.array(z.object({ id: z.string(), name: z.string(), path: z.string() }))
const Threads = z.array(
  z.object({
    id: z.string(),
    project_id: z.string().nullable(),
    name: z.string().nullable(),
    title: z.string(),
    updatedAt: z.number().nullable().optional()
  })
)
const Pins = z.array(z.object({ id: z.string() }))

export function readCodexSidebar(dbPath: string): CodexSidebarResult {
  const db = new SyncDatabase(dbPath, { readonly: true, fileMustExist: true, timeout: 250 })
  try {
    return readCodexSidebarDatabase(db)
  } finally {
    db.close()
  }
}

export function readCodexSidebarDatabase(db: SyncDatabase): CodexSidebarResult {
  db.pragma('query_only = ON')
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
  )
  if (
    !['projects', 'project_roots', 'threads', 'thread_sections'].every((table) => tables.has(table))
  ) {
    return { kind: 'unsupported' }
  }
  const columns = new Set(
    db
      .prepare('PRAGMA table_info(threads)')
      .all()
      .map((row) => row.name)
  )
  if (
    !['project_id', 'thread_section_id', 'section_position'].every((column) => columns.has(column))
  ) {
    return { kind: 'unsupported' }
  }
  db.exec('BEGIN')
  try {
    const roots = Roots.parse(
      db
        .prepare(
          'SELECT p.id, p.name, r.path FROM projects p JOIN project_roots r ON r.project_id = p.id ORDER BY p.position, r.position'
        )
        .all()
    )
    const projects: { id: string; name: string; paths: string[] }[] = []
    for (const row of roots) {
      const project = projects.find((project) => project.id === row.id)
      if (project) {
        project.paths.push(row.path)
      } else {
        projects.push({ id: row.id, name: row.name, paths: [row.path] })
      }
    }
    const updatedAt = columns.has('updated_at_ms')
      ? columns.has('updated_at')
        ? ', COALESCE(updated_at_ms, updated_at * 1000) AS updatedAt'
        : ', updated_at_ms AS updatedAt'
      : columns.has('updated_at')
        ? ', updated_at * 1000 AS updatedAt'
        : ''
    const threads = Threads.parse(
      db
        .prepare(
          `SELECT id, project_id, ${columns.has('name') ? 'name' : 'NULL AS name'}, title${updatedAt} FROM threads WHERE archived = 0`
        )
        .all()
    )
    const pinned = Pins.parse(
      db
        .prepare(
          'SELECT t.id FROM threads t JOIN thread_sections s ON s.id = t.thread_section_id WHERE s.name = ? AND t.archived = 0 ORDER BY t.section_position, t.id'
        )
        .all('Pinned')
    ).map((row) => row.id)
    return {
      kind: 'ok',
      structure: {
        available: true,
        projects,
        assignments: Object.fromEntries(
          threads.flatMap((thread) => (thread.project_id ? [[thread.id, thread.project_id]] : []))
        ),
        pinned,
        titles: Object.fromEntries(
          threads.map((thread) => [thread.id, thread.name?.trim() || thread.title])
        ),
        ...(updatedAt
          ? {
              updatedAt: Object.fromEntries(
                threads.flatMap((thread) =>
                  thread.updatedAt !== null &&
                  thread.updatedAt !== undefined &&
                  Number.isFinite(thread.updatedAt) &&
                  thread.updatedAt >= 0
                    ? [[thread.id, thread.updatedAt]]
                    : []
                )
              )
            }
          : {})
      }
    }
  } finally {
    db.exec('ROLLBACK')
  }
}
