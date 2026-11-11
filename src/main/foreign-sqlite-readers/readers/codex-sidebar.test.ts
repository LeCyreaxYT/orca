import { expect, it } from 'vitest'
import SyncDatabase from '../../sqlite/sync-database'
import { readCodexSidebarDatabase } from './codex-sidebar'

it('reads current project membership, renamed chats and section pins even when the old is_pinned flag is zero', () => {
  const db = new SyncDatabase(':memory:')
  try {
    db.exec(`
      CREATE TABLE projects(id TEXT, name TEXT, position INTEGER);
      CREATE TABLE project_roots(project_id TEXT, position INTEGER, path TEXT);
      CREATE TABLE thread_sections(id TEXT, name TEXT);
      CREATE TABLE threads(id TEXT, project_id TEXT, name TEXT, title TEXT, archived INTEGER, is_pinned INTEGER, thread_section_id TEXT, section_position INTEGER, updated_at INTEGER, updated_at_ms INTEGER, recency_at INTEGER, recency_at_ms INTEGER);
      INSERT INTO projects VALUES('scripts','Scripts',0);
      INSERT INTO project_roots VALUES('scripts',0,'F:/Scripts');
      INSERT INTO thread_sections VALUES('fixed-pin-id','Pinned');
      INSERT INTO threads VALUES('jobs','scripts','SKY JOBSCREATOR','Old title',0,0,'fixed-pin-id',0,9,9999,1,1234);
      INSERT INTO threads VALUES('ordinary','scripts',NULL,'Ordinary chat',0,0,NULL,1,2,NULL,NULL,NULL);
      INSERT INTO threads VALUES('archived','scripts','Archived','Archived',1,0,'fixed-pin-id',2,3,3456,3,NULL);
    `)
    expect(readCodexSidebarDatabase(db)).toEqual({
      kind: 'ok',
      structure: {
        available: true,
        projects: [{ id: 'scripts', name: 'Scripts', paths: ['F:/Scripts'] }],
        assignments: { jobs: 'scripts', ordinary: 'scripts' },
        pinned: ['jobs'],
        titles: { jobs: 'SKY JOBSCREATOR', ordinary: 'Ordinary chat' },
        updatedAt: { jobs: 1234, ordinary: 2000 }
      }
    })
    db.pragma('query_only = OFF')
    db.exec(
      'ALTER TABLE threads DROP COLUMN recency_at_ms; ALTER TABLE threads DROP COLUMN recency_at;'
    )
    expect(readCodexSidebarDatabase(db)).toMatchObject({
      kind: 'ok',
      structure: { updatedAt: { jobs: 9999, ordinary: 2000 } }
    })
  } finally {
    db.close()
  }
})

it('identifies older schemas so the caller can use the legacy project source', () => {
  const db = new SyncDatabase(':memory:')
  try {
    expect(readCodexSidebarDatabase(db)).toEqual({ kind: 'unsupported' })
  } finally {
    db.close()
  }
})
