#!/usr/bin/env node

import chalk from 'chalk'
import yargs from 'yargs/yargs'
import path from 'path'
import fs from 'fs-extra'
import semver from 'semver'
import { describeFilter, fetchChangelog } from '../index'
import { debug } from '../util/debug'

/* eslint-env node */
const yargsInstance = yargs(process.argv.slice(2))
  .usage(
    `Usage: $0 <pkg>[@<range>]

  Prints changelog entries for an npm package from GitHub.
  (Other repository hosts aren't currently supported.)`
  )
  .options({
    range: {
      alias: 'r',
      describe: 'semver version range to get changelog entries for',
      type: 'string',
      coerce: (value: string): string => {
        if (!semver.validRange(value))
          throw new Error(`invalid --range: ${value}`)
        return value
      },
    },
    json: {
      describe: 'output json',
      type: 'boolean',
    },
    major: {
      alias: 'M',
      describe: 'only include major releases',
      type: 'boolean',
    },
    minor: {
      alias: 'm',
      describe: 'only include minor/major releases',
      type: 'boolean',
    },
    pre: {
      describe: 'include prereleases',
      type: 'boolean',
    },
  })
  .help()

async function go() {
  const argv = await yargsInstance.argv
  let {
    _: [pkg],
    range,
  } = argv
  const { json } = argv
  debug('process.version:', process.version)
  debug('process.execPath:', process.execPath)
  debug(argv)
  if (typeof pkg !== 'string') {
    yargsInstance.showHelp()
    process.exit(1)
  }

  const filters = [
    ...(argv.major ? ['major'] : []),
    ...(argv.minor ? ['minor'] : []),
    ...(argv.pre ? ['pre'] : []),
  ]
  if (filters.length > 1) {
    throw new Error(
      `can't combine ${filters.map((f) => `--${f}`).join(' and ')}`
    )
  }

  if (!range) {
    const match = /^(@?[^@]+)@(.+)$/.exec(pkg)
    if (match) {
      pkg = match[1]
      range = match[2]
    } else {
      try {
        const { version } = await fs.readJson(
          require.resolve(path.join(pkg, 'package.json'), {
            paths: [process.cwd()],
          })
        )
        range = `>${version}`
      } catch (error) {
        // ignore
      }
    }
  }

  try {
    const include = {
      range,
      prerelease: argv.pre,
      minor: argv.pre || !argv.major,
      patch: argv.pre || (!argv.major && !argv.minor),
    }
    // eslint-disable-next-line no-console
    console.error(
      `fetching ${describeFilter({
        pkg,
        include,
        highlight: !process.env.CI && process.stdout.isTTY,
      })}...`
    )
    const changelog = await fetchChangelog(pkg, {
      include,
    })
    if (json) {
      process.stdout.write(JSON.stringify(changelog, null, 2))
    } else {
      for (const version in changelog) {
        if (!Object.prototype.hasOwnProperty.call(changelog, version)) continue
        const { header, body, error } = changelog[version]
        process.stdout.write(chalk.bold(header) + '\n\n')
        if (body) process.stdout.write(body + '\n\n')
        if (error) {
          process.stdout.write(`Failed to get changelog: ${error.stack}\n\n`)
        }
      }
    }
    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  }
}
go()
