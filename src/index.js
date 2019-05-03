#!/usr/bin/env node
/* @flow */

import chalk from 'chalk'
import npmRegistryFetch from 'npm-registry-fetch'
import fetch from 'node-fetch'
import parseChangelog, { type Release } from './changelog-parser'
import semver from 'semver'
import Octokit from '@octokit/rest'

const octokitOptions = {}
if (process.env.GH_TOKEN) octokitOptions.auth = `token ${process.env.GH_TOKEN}`
const octokit = new Octokit(octokitOptions)

export async function getChangelog(
  owner: string,
  repo: string
): Promise<Array<Release>> {
  let changelog
  for (const file of ['CHANGELOG.md', 'changelog.md']) {
    const changelogUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${file}`
    const res = await fetch(changelogUrl)
    if (res.ok) {
      changelog = await res.text()
      break
    }
  }
  if (!changelog) throw new Error('failed to get changelog')
  return await parseChangelog(changelog)
}

export async function whatBroke(
  pkg: string,
  {
    fromVersion,
    toVersion,
  }: {
    fromVersion?: ?string,
    toVersion?: ?string,
  } = {}
): Promise<Object> {
  const npmInfo = await npmRegistryFetch.json(pkg)
  const { repository: { url } = {} } = npmInfo
  if (!url) throw new Error('failed to get repository.url')
  const match = /github\.com\/([^\\]+)\/([^.\\]+)/i.exec(url)
  if (!match) throw new Error(`repository.url not supported: ${url}`)
  const [owner, repo] = match.slice(1)
  let changelog
  await getChangelog(owner, repo)
    .then(c => (changelog = c))
    .catch(() => {})

  const result = []

  if (changelog) {
    let prevVersion = fromVersion
    for (const release of changelog.reverse()) {
      const { version } = release
      if (!version) continue
      if (prevVersion && semver.lte(version, prevVersion)) continue
      if (toVersion && semver.gt(version, toVersion)) break
      if (
        prevVersion == null ||
        semver.prerelease(version) ||
        !semver.satisfies(version, `^${prevVersion}`)
      ) {
        result.push(release)
        prevVersion = version
      }
    }
  } else {
    const versions = Object.keys(npmInfo.versions)

    let prevVersion = fromVersion
    for (const version of versions) {
      if (!version) continue
      if (prevVersion && semver.lte(version, prevVersion)) continue
      if (toVersion && semver.gt(version, toVersion)) break
      if (
        prevVersion == null ||
        semver.prerelease(version) ||
        !semver.satisfies(version, `^${prevVersion}`)
      ) {
        await octokit.repos
          .getReleaseByTag({
            owner,
            repo,
            tag: `v${version}`,
          })
          .then(({ data: { body } }: Object) => {
            result.push({ version, body })
          })
          .catch(() => {})

        prevVersion = version
      }
    }
  }

  return result
}

if (!module.parent) {
  const pkg = process.argv[2]
  let fromVersion = process.argv[3],
    toVersion = process.argv[4]
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
  whatBroke(pkg, { fromVersion, toVersion }).then(
    (changelog: Array<Release>) => {
      for (const { version, body } of changelog) {
        process.stdout.write(chalk.bold(version) + '\n\n')
        if (body) process.stdout.write(body + '\n\n')
      }
      process.exit(0)
    },
    (error: Error) => {
      process.stderr.write(error.stack + '\n')
      process.exit(1)
    }
  )
}
