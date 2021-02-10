// @flow

import npmRegistryFetch from 'npm-registry-fetch'
import { Base64 } from 'js-base64'
import parseChangelog, { type Release } from './parseChangelog'
import semver from 'semver'
import getConfig from './getConfig'
import _Octokit from '@octokit/rest'
import octokitThrottling from '@octokit/plugin-throttling'
import memoize from './util/memoize'
import once from './util/once'

const getOctokit = once(async (): Promise<any> => {
  const Octokit = _Octokit.plugin(octokitThrottling)

  const { githubToken } = await getConfig()

  type LimitOptions = {
    method: string,
    url: string,
    request: {
      retryCount: number,
    },
  }

  const octokitOptions: Object = {
    throttle: {
      onRateLimit: (retryAfter: number, options: LimitOptions): boolean => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        )
        return options.request.retryCount < 3
      },
      onAbuseLimit: (retryAfter: number, options: LimitOptions) => {
        // does not retry, only logs a warning
        octokit.log.warn(
          `Abuse detected for request ${options.method} ${options.url}`
        )
      },
    },
  }
  if (githubToken) octokitOptions.auth = `token ${githubToken}`
  const octokit = new Octokit(octokitOptions)
  return octokit
})

export const getChangelogFromFile: (
  owner: string,
  repo: string
) => Promise<{ [string]: Release }> = memoize(
  async (owner: string, repo: string): Promise<{ [string]: Release }> => {
    const octokit = await getOctokit()
    let changelog
    let lastError: ?Error
    for (const file of ['CHANGELOG.md', 'changelog.md']) {
      try {
        const {
          data: { content },
        } = await octokit.repos.getContents({
          owner,
          repo,
          path: file,
        })
        changelog = Base64.decode(content)
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

function parseRepositoryUrl(url: string): { owner: string, repo: string } {
  const match = /github\.com[:/]([^\\]+)\/([^.\\]+)/i.exec(url)
  if (!match) throw new Error(`repository.url not supported: ${url}`)
  const [owner, repo] = match.slice(1)
  return { owner, repo }
}

export type IncludeOption =
  | ((version: string) => boolean)
  | {
      range?: ?string,
      prerelease?: ?boolean,
      minor?: ?boolean,
      patch?: ?boolean,
    }

function includeFilter(include: ?IncludeOption): (version: string) => boolean {
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

export type Options = {
  include?: ?IncludeOption,
}

export async function fetchChangelog(
  pkg: string,
  { include }: Options = {}
): Promise<{ [version: string]: Release }> {
  const { npmToken } = await getConfig()
  const octokit = await getOctokit()

  const npmInfo = await npmRegistryFetch.json(pkg, {
    token: npmToken,
  })

  const versions = Object.keys(npmInfo.versions).filter(includeFilter(include))

  const releases = {}

  for (let version of versions) {
    const release: Release = {
      version,
      header: `# ${version}`,
      date: new Date(npmInfo.time[version]),
    }
    releases[version] = release

    const { url } =
      npmInfo.versions[version].repository || npmInfo.repository || {}
    if (!url) {
      release.error = new Error('failed to get repository url from npm')
    }

    try {
      const { owner, repo } = parseRepositoryUrl(url)

      try {
        const body = (
          await octokit.repos
            .getReleaseByTag({
              owner,
              repo,
              tag: `v${version}`,
            })
            .catch(() =>
              octokit.repos.getReleaseByTag({
                owner,
                repo,
                tag: version,
              })
            )
        ).data.body

        release.body = body

        const parsed = parseChangelog(body)
        for (let v in parsed) {
          if (v === version) {
            const { header, body } = parsed[v]
            if (header) release.header = header
            if (body) release.body = body
            break
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
      release.error = error
    }
  }

  return releases
}
