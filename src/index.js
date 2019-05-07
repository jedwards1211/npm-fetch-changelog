#!/usr/bin/env node
/* @flow */

import chalk from 'chalk'
import npmRegistryFetch from 'npm-registry-fetch'
import { Base64 } from 'js-base64'
import parseChangelog, { type Release } from './parseChangelog'
import semver from 'semver'
import _Octokit from '@octokit/rest'
import octokitThrottling from '@octokit/plugin-throttling'
import getNpmToken from './getNpmToken'
import memoize from './util/memoize'

const Octokit = _Octokit.plugin(octokitThrottling)

const { GH_TOKEN } = process.env

type LimitOptions = {
  method: string,
  url: string,
  request: {
    retryCount: number,
  },
}

const octokitOptions: Object = {
  throttle: {
    onRateLimit: (retryAfter: number, options: LimitOptions) => {
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
if (GH_TOKEN) octokitOptions.auth = `token ${GH_TOKEN}`
const octokit = new Octokit(octokitOptions)

export const getChangelog = memoize(
  async (owner: string, repo: string): Promise<{ [string]: Release }> => {
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
): Promise<Object> {
  const npmInfo = await npmRegistryFetch.json(pkg, {
    token: await getNpmToken(),
  })

  const versions = Object.keys(npmInfo.versions).filter(includeFilter(include))

  const releases = []

  for (let version of versions) {
    const release: Release = {
      version,
      header: `# ${version}`,
      date: new Date(npmInfo.time[version]),
    }
    releases.push(release)

    const { url } =
      npmInfo.versions[version].repository || npmInfo.repository || {}
    if (!url) {
      release.error = new Error('failed to get repository url from npm')
    }

    try {
      const { owner, repo } = parseRepositoryUrl(url)

      try {
        const body = (await octokit.repos
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
          )).data.body

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
        const changelog = await getChangelog(owner, repo)
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

if (!module.parent) {
  let {
    argv: {
      _: [pkg],
      range,
      includePrereleases: prereleases,
      minor,
      patch,
    },
  } = require('yargs')
    .usage(
      `Usage: $0 <package name>

Fetches changelog entries for an npm package from GitHub.
(Other repository hosts aren't currently supported.)`
    )
    .option('r', {
      alias: 'range',
      describe: 'semver version range to get changelog entries for',
      type: 'string',
    })
    .option('prereleases', {
      describe: 'include prerelease versions',
      type: 'boolean',
      default: false,
    })
    .default('minor', true)
    .boolean('minor')
    .hide('minor')
    .describe('no-minor', 'exclude minor versions')
    .default('patch', undefined)
    .boolean('patch')
    .hide('patch')
    .describe('no-patch', 'exclude patch versions')
    .hide('version')

  if (!pkg) {
    require('yargs').showHelp()
    process.exit(1)
  }
  if (!range) {
    try {
      // $FlowFixMe
      const { version } = require(require.resolve(
        require('path').join(pkg, 'package.json'),
        {
          paths: [process.cwd()],
        }
      ))
      range = `>${version}`
    } catch (error) {
      // ignore
    }
  }

  /* eslint-env node */
  fetchChangelog(pkg, {
    include: {
      range,
      prereleases,
      minor,
      patch,
    },
  }).then(
    (changelog: Array<Release>) => {
      for (const { header, body, error } of changelog) {
        process.stdout.write(chalk.bold(header) + '\n\n')
        if (body) process.stdout.write(body + '\n\n')
        if (error) {
          process.stdout.write(`Failed to get changelog: ${error.stack}\n\n`)
        }
      }
      process.exit(0)
    },
    (error: Error) => {
      process.stderr.write(error.stack + '\n')
      process.exit(1)
    }
  )
}
