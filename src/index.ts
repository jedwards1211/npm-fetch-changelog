import npmRegistryFetch from 'npm-registry-fetch'
import { Base64 } from 'js-base64'
import parseChangelog, { type Release } from './parseChangelog'
import semver from 'semver'
import getConfig from './getConfig'
import { Octokit } from 'octokit'
import memoize from './util/memoize'
import once from './util/once'
import { debug } from './util/debug'
import chalk from 'chalk'

const getOctokit = once(async (): Promise<Octokit> => {
  const { githubToken } = await getConfig()

  return new Octokit({
    ...(githubToken ? { auth: `token ${githubToken}` } : {}),
  })
})

async function doOctokit<
  Resource extends keyof Octokit['rest'] & string,
  Method extends keyof Octokit['rest'][Resource] & string
>(
  resource: Resource,
  method: Method,
  arg: Octokit['rest'][Resource][Method] extends (...args: infer Args) => any
    ? Args[0]
    : never
): Promise<
  Octokit['rest'][Resource][Method] extends (...args: any) => Promise<infer Ret>
    ? Ret
    : never
> {
  const octokit = await getOctokit()
  debug(
    `calling...    octokit.rest.${resource}.${method}(${JSON.stringify(arg)})`
  )
  try {
    const result = await (octokit.rest[resource][method] as any)(arg)
    debug(
      `call success  octokit.rest.${resource}.${method}(${JSON.stringify(arg)})`
    )
    return result
  } catch (error) {
    debug(
      `cail failed   octokit.rest.${resource}.${method}(${JSON.stringify(
        arg
      )})`,
      error
    )
    throw error
  }
}

export const getChangelogFromFile: (
  owner: string,
  repo: string
) => Promise<Record<string, Release>> = memoize(
  async (owner: string, repo: string): Promise<Record<string, Release>> => {
    let changelog: string | undefined
    let lastError: unknown
    for (const file of ['CHANGELOG.md', 'changelog.md']) {
      try {
        const { data: _data } = await doOctokit('repos', 'getContent', {
          owner,
          repo,
          path: file,
        })
        const data = Array.isArray(_data) ? _data[0] : _data
        if (data.type !== 'file') {
          throw new Error(`content isn't a file`)
        }
        changelog = data.content ? Base64.decode(data.content) : undefined
        break
      } catch (error) {
        lastError = error
        continue
      }
    }
    if (!changelog) {
      throw lastError || new Error(`failed to find changelog file`)
    }
    return await parseChangelog(changelog)
  },
  (owner, repo) => `${owner}/${repo}`
)

function parseRepositoryUrl(url: string): { owner: string; repo: string } {
  const match = /github\.com[:/]([^\\]+)\/([^\\]+)/i.exec(url)
  if (!match) throw new Error(`repository.url not supported: ${url}`)
  const [, owner, repo] = match
  return { owner, repo: repo.replace(/\.git$/, '') }
}

export type IncludeOptionObject = {
  range?: string | null
  prerelease?: boolean | null
  minor?: boolean | null
  patch?: boolean | null
}

export type IncludeOption = ((version: string) => boolean) | IncludeOptionObject

export function includeFilter(
  include?: IncludeOption | null
): (version: string) => boolean {
  if (!include) return () => true
  if (typeof include === 'function') return include
  const { range, prerelease, minor, patch = minor } = include
  return (version: string): boolean => {
    if (range && !semver.satisfies(version, range)) return false
    if (!prerelease && semver.prerelease(version)) return false
    if (minor === false && semver.minor(version)) return false
    if (patch === false && semver.patch(version)) return false
    return true
  }
}

export function describeFilter({
  pkg,
  include,
  highlight,
}: {
  pkg?: string
  include?: IncludeOption | null
  highlight?: boolean
}) {
  if (typeof include === 'function') {
    return `versions matching custom function`
  }
  const { range, prerelease, minor, patch } =
    include || ({} as IncludeOptionObject)

  const types: string[] = [
    ...(prerelease ? ['prerelease'] : []),
    'major',
    ...(minor === false ? [] : ['minor']),
    ...(patch === false ? [] : ['patch']),
  ]
  return [
    ...(range ? [] : [highlight ? chalk.greenBright('all') : 'all']),
    types.slice(0, Math.max(1, types.length - 1)).join(', '),
    ...(types.length > 1 ? [`and ${types[types.length - 1]}`] : []),
    'versions',
    ...(pkg ? [`of ${highlight ? chalk.bold(pkg) : pkg}`] : []),
    ...(range
      ? [
          /^[<>]/.test(range)
            ? `${highlight ? chalk.greenBright(range) : range}`
            : `satisfying ${highlight ? chalk.greenBright(range) : range}`,
        ]
      : []),
  ].join(' ')
}

export type Options = {
  include?: IncludeOption | null
}

export async function fetchChangelog(
  pkg: string,
  { include }: Options = {}
): Promise<{ [version: string]: Release }> {
  const { npmToken } = await getConfig()

  debug(
    `fetchChangelog(${JSON.stringify(pkg)}, ${JSON.stringify({ include })})`
  )

  const npmInfo: any = await npmRegistryFetch.json(pkg, {
    forceAuth: {
      token: npmToken,
    },
  })
  debug(`npmInfo.versions:\n  ${Object.keys(npmInfo.versions).join('\n  ')}`)

  const versions = Object.keys(npmInfo.versions).filter(includeFilter(include))
  debug(`filtered versions:\n  ${versions.join('\n  ')}`)

  const releases = await Promise.all(
    versions.map(async (version) => {
      const release: Release = {
        version,
        header: `# ${version}`,
        date: new Date(npmInfo.time[version]),
      }

      const { url } =
        npmInfo.versions[version].repository || npmInfo.repository || {}
      if (!url) {
        release.error = new Error('failed to get repository url from npm')
      }

      try {
        const { owner, repo } = parseRepositoryUrl(url)

        try {
          const tagFormats = [
            `v${version}`,
            version,
            `${pkg}@${version}`,
            `${pkg}@v${version}`,
            `${pkg}: v${version}`,
          ]

          let body: string | undefined
          for (const tag of tagFormats) {
            try {
              const result = await doOctokit('repos', 'getReleaseByTag', {
                owner,
                repo,
                tag,
              })
              body = result.data.body ?? undefined
              break
            } catch {
              continue
            }
          }

          release.body = body

          if (body) {
            const parsed = parseChangelog(body)
            for (const v in parsed) {
              if (v === version) {
                const { header, body } = parsed[v]
                if (header) release.header = header
                if (body) release.body = body
                break
              }
            }
          }
        } catch (error) {
          const changelog = await getChangelogFromFile(owner, repo)
          const { header, body } = changelog[version] || {}
          if (header) release.header = header
          release.body = body
        }
        if (!release.body) {
          release.error = new Error(
            `failed to find GitHub release or changelog entry for version ${version}`
          )
        }
      } catch (error) {
        release.error =
          error instanceof Error ? error : new Error(String(error))
      }

      return release
    })
  )

  return Object.fromEntries(
    releases
      .sort((a, b) => semver.compare(a.version, b.version))
      .map((release) => [release.version, release])
  )
}
