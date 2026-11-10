import { useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { SidebarChatMappingForm } from './SidebarChatMappingDialog'

const structure = {
  available: true,
  assignments: {},
  pinned: [],
  projects: [
    {
      id: 'gta',
      name: 'GTA5 Online Revamped',
      paths: ['F:/Development/_SkySystems/GTAOnlineTemplate']
    },
    { id: 'changes', name: 'Changelogs', paths: ['F:/Development/_SkySystems'] },
    { id: 'scripts', name: 'Scripts', paths: ['F:/Development/_SkySystems/Scripts'] },
    { id: 'phone', name: 'Scripts_Phone', paths: ['F:/Development/_SkySystems/Scripts_Phone'] }
  ]
}
const workspaces = [
  { id: 'gta', displayName: 'system/dev', path: structure.projects[0].paths[0] },
  { id: 'changes', displayName: '_SkySystems', path: structure.projects[1].paths[0] },
  { id: 'scripts', displayName: 'Scripts', path: structure.projects[2].paths[0] },
  { id: 'phone', displayName: 'Scripts_Phone', path: structure.projects[3].paths[0] }
]
function Form({ empty = false }: { empty?: boolean }) {
  const [choices, setChoices] = useState(
    structure.projects.map((project) => ({
      projectId: project.id,
      workspaceId: project.id,
      claude: true
    }))
  )
  const [claudeFolders, setClaudeFolders] = useState([
    { id: 'custom-claude', path: '/home/alec/design', workspaceId: '' }
  ])
  return (
    <div className="bg-background p-6 text-foreground">
      <SidebarChatMappingForm
        structure={empty ? { ...structure, projects: [] } : structure}
        {...{ workspaces, choices, setChoices, claudeFolders, setClaudeFolders }}
      />
    </div>
  )
}
export const projects = defineFixture({ width: 640, render: () => <Form /> })
export const narrow = defineFixture({ width: 360, render: () => <Form /> })
export const noCodex = defineFixture({ width: 560, render: () => <Form empty /> })
