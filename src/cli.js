#!/usr/bin/env node
// @flow

import chalk from 'chalk'
import yargs from 'yargs'
import path from 'path'
import { fetchChangelog } from './index'
import { type Release } from './parseChangelog'

/* eslint-env node */
const { argv } = yargs
  .usage(
    `Usage: $0 <package name>[@<range>]

Prints changelog entries for an npm package from GitHub.
(Other repository hosts aren't currently supported.)`
  )
  .option('r', {
    alias: 'range',
    describe: 'semver version range to get changelog entries for',
    type: 'string',
  })
  .option('json', {
    describe: 'output json',
    type: 'boolean',
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

let {
  _: [pkg],
  range,
  includePrereleases: prerelease,
  minor,
  patch,
  json,
} = argv

if (!pkg) {
  yargs.showHelp()
  process.exit(1)
}
if (!range) {
  const match = /^(@?[^@]+)@(.+)$/.exec(pkg)
  if (match) {
    pkg = match[1]
    range = match[2]
  } else {
    try {
      // $FlowFixMe
      const { version } = require(require.resolve(
        path.join(pkg, 'package.json'),
        {
          paths: [process.cwd()],
        }
      ))
      range = `>${version}`
    } catch (error) {
      // ignore
    }
  }
}

fetchChangelog(pkg, {
  include: {
    range,
    prerelease,
    minor,
    patch,
  },
}).then(
  (changelog: { [version: string]: Release }) => {
    if (json) {
      process.stdout.write(JSON.stringify(changelog, null, 2))
    } else {
      for (const version in changelog) {
        if (!changelog.hasOwnProperty(version)) continue
        const { header, body, error } = changelog[version]
        process.stdout.write(chalk.bold(header) + '\n\n')
        if (body) process.stdout.write(body + '\n\n')
        if (error) {
          process.stdout.write(`Failed to get changelog: ${error.stack}\n\n`)
        }
      }
    }
    process.exit(0)
  },
  (error: Error) => {
    process.stderr.write(error.stack + '\n')
    process.exit(1)
  }
)
