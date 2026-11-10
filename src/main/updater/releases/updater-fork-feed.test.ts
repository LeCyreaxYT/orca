import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installNetRequestFetchAdapter } from '../testing/updater-net-request.fixture'

const { fetchMock, requestMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  requestMock: vi.fn()
}))

vi.mock('electron', () => ({ net: { fetch: fetchMock, request: requestMock } }))

let latestRedirect: string

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('ORCA_UPDATE_REPOSITORY', 'example/orca-sky')
  latestRedirect = 'https://github.com/example/orca-sky/releases/tag/v9.0.1'
  fetchMock.mockReset()
  requestMock.mockReset()
  installNetRequestFetchAdapter(requestMock, fetchMock)
  fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url === 'https://github.com/example/orca-sky/releases.atom') {
      return new Response(
        '<feed><entry><link href="https://github.com/stablyai/orca/releases/tag/v99.0.0"/></entry>' +
          '<entry><link href="https://github.com/example/orca-sky/releases/tag/v9.0.1"/></entry></feed>'
      )
    }
    if (url === 'https://github.com/example/orca-sky/releases/latest') {
      return new Response(null, { status: 302, headers: { location: latestRedirect } })
    }
    if (
      url.startsWith('https://github.com/example/orca-sky/releases/download/v9.0.1/') &&
      url.endsWith('.yml')
    ) {
      return new Response(
        'version: 9.0.1\nfiles:\n  - url: https://github.com/example/orca-sky/releases/download/v9.0.1/Orca-test.zip\n    sha512: test\n'
      )
    }
    if (
      url === 'https://github.com/example/orca-sky/releases/download/v9.0.1/Orca-test.zip' &&
      options?.method === 'HEAD'
    ) {
      return new Response(null, { status: 200 })
    }
    return new Response(null, { status: 404 })
  })
})

afterEach(() => vi.unstubAllGlobals())

it('selects an installable fork release and excludes upstream entries in its feed', async () => {
  const { fetchNewerReleaseTagsWithReadiness } = await import('./updater-prerelease-feed')
  expect(
    await fetchNewerReleaseTagsWithReadiness('1.0.0', 2, { includePrerelease: false })
  ).toEqual({ tags: ['v9.0.1'], state: 'ready' })
})

it('resolves fork latest releases and refuses a redirect into the upstream repository', async () => {
  const { fetchLatestStableReleaseTag } = await import('./updater-prerelease-feed')
  expect(await fetchLatestStableReleaseTag()).toBe('v9.0.1')
  latestRedirect = 'https://github.com/stablyai/orca/releases/tag/v99.0.0'
  expect(await fetchLatestStableReleaseTag()).toBeNull()
})

it('keeps explicit channel switches on the fork repository', async () => {
  const { resolveTargetBuild } = await import('./updater-release-builds')
  expect(resolveTargetBuild('hourly', 'v9.0.0-hourly.202611101700')).toMatchObject({
    feedUrl: 'https://github.com/example/orca-sky/releases/download/v9.0.0-hourly.202611101700'
  })
})
