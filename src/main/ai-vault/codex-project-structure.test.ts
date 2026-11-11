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

it('joins native project IDs to desktop memberships while thread migration is incomplete', () => {
  const result = parseCodexProjectStructure(
    {
      'local-projects': {
        releases: { id: 'releases', name: 'Releases', rootPaths: ['F:/Sky'] }
      },
      'thread-project-assignments': {
        latest: { projectKind: 'local', projectId: 'releases' },
        removed: { projectKind: 'local', projectId: 'releases' }
      },
      'projectless-thread-ids': ['removed'],
      'app-server-project-id-by-legacy-project-id-by-host': {
        'local:C:/Codex': { releases: 'native-releases' },
        'local:/mnt/c/Codex': { releases: 'foreign-releases' }
      },
      'app-server-projects-migration-by-host': {
        'local:C:/Codex': { threadAssignmentsMigrated: false }
      }
    },
    {
      home: 'C:\\Codex',
      native: {
        available: true,
        projects: [{ id: 'native-releases', name: 'Releases', paths: ['F:/Sky'] }],
        assignments: { older: 'native-releases' },
        pinned: ['latest'],
        titles: { latest: 'Publish patches', older: 'Prepare release' },
        updatedAt: { latest: 2000, older: 1000 }
      }
    }
  )
  expect(result).toEqual({
    available: true,
    projects: [{ id: 'releases', name: 'Releases', paths: ['F:/Sky'] }],
    assignments: { older: 'releases', latest: 'releases' },
    pinned: ['latest'],
    titles: { latest: 'Publish patches', older: 'Prepare release' },
    updatedAt: { latest: 2000, older: 1000 },
    projectAliases: { 'native-releases': 'releases' },
    projectless: ['removed']
  })
})

it('keeps a native project removal after thread membership migration completes', () => {
  const result = parseCodexProjectStructure(
    {
      'local-projects': {
        releases: { id: 'releases', name: 'Releases', rootPaths: ['F:/Sky'] }
      },
      'thread-project-assignments': {
        movedOut: { projectKind: 'local', projectId: 'releases' }
      },
      'app-server-project-id-by-legacy-project-id-by-host': {
        'local:C:/Codex': { releases: 'native-releases' }
      },
      'app-server-projects-migration-by-host': {
        'local:C:/Codex': { threadAssignmentsMigrated: true }
      }
    },
    {
      home: 'C:/Codex',
      native: {
        available: true,
        projects: [{ id: 'native-releases', name: 'Releases', paths: ['F:/Sky'] }],
        assignments: {},
        pinned: [],
        titles: { movedOut: 'Unassigned chat' }
      }
    }
  )
  expect(result.assignments).toEqual({})
  expect(result.projectless).toEqual(['movedOut'])
})
