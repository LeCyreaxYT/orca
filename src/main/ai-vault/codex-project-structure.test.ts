import { expect, it } from 'vitest'
import { parseCodexProjectStructure } from './codex-project-structure'

it('reads ordered local projects and excludes foreign-host and remote chat assignments', () => {
  const result = parseCodexProjectStructure({
    'local-projects': {
      scripts: { id: 'scripts', name: 'Scripts', rootPaths: ['F:/Scripts', 'F:/Scripts/tool'] },
      phone: { id: 'phone', name: 'Phone', rootPaths: ['F:/Scripts_Phone'] },
      invalid: { rootPaths: [] }
    },
    'project-order': ['phone', 'scripts'],
    'thread-project-assignments': {
      local: { projectKind: 'local', projectId: 'scripts' },
      remote: { projectKind: 'remote', projectId: 'scripts' },
      foreign: { projectKind: 'local', projectId: 'scripts' },
      deleted: { projectKind: 'local', projectId: 'deleted' }
    },
    'thread-project-membership-host-ids': { foreign: 'ssh:other' },
    'pinned-thread-ids': ['local']
  })
  expect(result).toEqual({
    available: true,
    projects: [
      { id: 'phone', name: 'Phone', paths: ['F:/Scripts_Phone'] },
      { id: 'scripts', name: 'Scripts', paths: ['F:/Scripts', 'F:/Scripts/tool'] }
    ],
    assignments: { local: 'scripts' },
    pinned: ['local']
  })
})
