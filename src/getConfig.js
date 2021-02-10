// @flow

import * as fs from 'fs-extra'
import path from 'path'
import os from 'os'
import once from './util/once'

const configFilePath = path.join(
  os.homedir(),
  '.config',
  'npm-fetch-changelog.json'
)

type Config = {
  githubToken?: string,
  npmToken?: string,
}

const getConfig = once(async function getConfig(): Promise<Config> {
  const result: Config = {}

  await Promise.all([
    fs
      .readJson(configFilePath)
      .then((raw: any) => {
        if (typeof raw.githubToken === 'string')
          result.githubToken = raw.githubToken
        if (typeof raw.npmToken === 'string') result.npmToken = raw.npmToken
      })
      .catch(() => {}),
    fs
      .readFile(path.join(os.homedir(), '.npmrc'), 'utf8')
      .then((npmrc: any) => {
        const match = /:_authToken=([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})/.exec(
          npmrc
        )
        if (match) result.npmToken = match[1]
      })
      .catch(() => {}),
  ])

  if (process.env.GH_TOKEN) result.githubToken = process.env.GH_TOKEN
  if (process.env.NPM_TOKEN) result.npmToken = process.env.NPM_TOKEN
  return result
})

export default getConfig
