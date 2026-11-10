import { readFileSync } from 'node:fs'

export function resolveBuildUpdateRepository() {
  const metadata = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  const repository = metadata.orcaUpdateRepository ?? null
  if (
    repository !== null &&
    (typeof repository !== 'string' || !/^[\w-]+\/[\w.-]+$/.test(repository))
  ) {
    throw new Error('orcaUpdateRepository must be a GitHub owner/repository.')
  }
  return repository
}
