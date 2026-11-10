import { afterEach, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createWindowsMcpServer } from './windows-mcp-server'

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close()
  }
})

it('pins actions to an observed window and consumes the observation even after uncertain delivery', async () => {
  const methods: string[] = []
  const server = createWindowsMcpServer({
    call: async (method: string) => {
      methods.push(method)
      if (method === 'computer.click') {
        throw new Error('Delivery unknown; observe effects before retrying.')
      }
      return {
        id: 'rpc',
        ok: true as const,
        result: { snapshot: { id: 'snap-one' } },
        _meta: { runtimeId: 'fixture' }
      }
    }
  })
  const client = new Client({ name: 'prototype-consumer', version: '1' })
  const [caller, host] = InMemoryTransport.createLinkedPair()
  await server.connect(host)
  await client.connect(caller)
  closers.push(
    () => client.close(),
    () => server.close()
  )
  const target = { app: '500', windowId: 7 }
  const action = { ...target, action: 'click', snapshotId: 'snap-one', elementIndex: 2 }
  expect((await client.callTool({ name: 'windows_action', arguments: action })).isError).toBe(true)
  expect(methods).toEqual([])
  await client.callTool({ name: 'windows_observe', arguments: target })
  expect(
    (await client.callTool({ name: 'windows_action', arguments: { ...action, windowId: 8 } }))
      .isError
  ).toBe(true)
  expect((await client.callTool({ name: 'windows_action', arguments: action })).isError).toBe(true)
  expect((await client.callTool({ name: 'windows_action', arguments: action })).isError).toBe(true)
  expect(methods).toEqual(['computer.getAppState', 'computer.click'])
  const tools = await client.listTools()
  expect(tools.tools.find((tool) => tool.name === 'browser_click')?.inputSchema.required).toContain(
    'expectUrl'
  )
})
