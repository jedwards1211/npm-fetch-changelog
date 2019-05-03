#!/usr/bin/env node
/* @flow */

import chalk from 'chalk'
import npmRegistryFetch from 'npm-registry-fetch'
import { Base64 } from 'js-base64'
import parseChangelog, { type Release } from './changelog-parser'
import semver from 'semver'
import Octokit from '@octokit/rest'
import getNpmToken from './getNpmToken'
import memoize from './util/memoize'

const { GH_TOKEN } = process.env

const octokitOptions = {}
if (GH_TOKEN) octokitOptions.auth = `token ${GH_TOKEN}`
const octokit = new Octokit(octokitOptions)

export const getChangelog = memoize(
  async (owner: string, repo: string): Promise<{ [string]: Release }> => {
    let changelog
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
        continue
      }
    }
    if (!changelog) throw new Error('failed to get changelog')
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

export async function whatBroke(
  pkg: string,
  {
    fromVersion,
    toVersion,
    full,
  }: {
    fromVersion?: ?string,
    toVersion?: ?string,
    full?: ?boolean,
  } = {}
): Promise<Object> {
  const npmInfo = await npmRegistryFetch.json(pkg, {
    token: await getNpmToken(),
  })

  const versions = Object.keys(npmInfo.versions).filter(
    (v: string): boolean => {
      if (fromVersion && !semver.gt(v, fromVersion)) return false
      if (toVersion && !semver.lt(v, toVersion)) return false
      return true
    }
  )

  const releases = []

  let prevVersion = fromVersion
  for (let version of versions) {
    if (
      !full &&
      prevVersion != null &&
      !semver.prerelease(version) &&
      semver.satisfies(version, `^${prevVersion}`) &&
      !(semver.prerelease(prevVersion) && !semver.prerelease(version))
    ) {
      continue
    }
    prevVersion = version

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
        const body = (await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag: `v${version}`,
        })).data.body

        release.body = body

        const parsed = parseChangelog(body)
        for (let v in parsed) {
          if (v === version) {
            const { header, body } = parsed[v]
            release.header = header
            release.body = body
            break
          }
        }
      } catch (error) {
        const changelog = await getChangelog(owner, repo)
        const { header, body } = changelog[version] || {}
        release.header = header
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
  const full = process.argv.indexOf('--full') >= 0
  const args = process.argv.slice(2).filter(a => a[0] !== '-')
  const pkg = args[0]
  let fromVersion = args[1],
    toVersion = args[2]
  if (!fromVersion) {
    try {
      // $FlowFixMe
      fromVersion = require(require.resolve(
        require('path').join(pkg, 'package.json'),
        {
          paths: [process.cwd()],
        }
      )).version
    } catch (error) {
      // ignore
    }
  }
  /* eslint-env node */
  whatBroke(pkg, { fromVersion, toVersion, full }).then(
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
