import * as fs from 'fs-extra'
import path from 'path'
import os from 'os'
import once from './util/once'
import { spawn } from 'promisify-child-process'
import { debug } from './util/debug'

const configFilePath = path.join(
  os.homedir(),
  '.config',
  'npm-fetch-changelog.json'
)

type Config = {
  githubToken?: string
  npmToken?: string
}

const getConfig: () => Promise<Config> = once(
  async function getConfig(): Promise<Config> {
    type ConfigSource = {
      file: string
      config?: Config
      error?: any
    }

    const configSources: ConfigSource[] = await Promise.all([
      (async (): Promise<ConfigSource> => {
        try {
          const { githubToken, npmToken } = await fs.readJson(configFilePath)
          return {
            file: '~/.config/npm-fetch-changelog.json',
            config: {
              githubToken:
                typeof githubToken === 'string' ? githubToken : undefined,
              npmToken: typeof npmToken === 'string' ? npmToken : undefined,
            },
          }
        } catch (error) {
          return {
            file: '~/.config/npm-fetch-changelog.json',
            error,
          }
        }
      })(),
      (async (): Promise<ConfigSource> => {
        try {
          const npmrc = await fs.readFile(
            path.join(os.homedir(), '.npmrc'),
            'utf8'
          )
          const npmToken = /\/\/registry\.npmjs\.org\/?:_authToken=(\S+)/.exec(
            npmrc
          )?.[1]
          return { file: '~/.npmrc', config: { npmToken } }
        } catch (error) {
          return { file: '~/.npmrc', error }
        }
      })(),
      (async (): Promise<ConfigSource> => {
        try {
          const githubToken = (
            await spawn('gh', ['auth', 'token'], {
              stdio: 'pipe',
              maxBuffer: 1024,
            })
          ).stdout
            ?.toString()
            .trim()
          return {
            file: 'gh auth token',
            config: { githubToken },
          }
        } catch (error) {
          return {
            file: 'gh auth token',
            error,
          }
        }
      })(),
      {
        file: 'process.env.GH_TOKEN',
        config: { githubToken: process.env.GH_TOKEN || undefined },
      },
      {
        file: 'process.env.NPM_TOKEN',
        config: { npmToken: process.env.NPM_TOKEN || undefined },
      },
    ])

    const result: Config = {}

    for (const { file, config, error } of configSources) {
      if (error) {
        if ((error as any)?.code === 'ENOENT') {
          debug(`${file} not found`)
        } else {
          debug(
            `failed to read ${file}`,
            error instanceof Error ? error.stack : error
          )
        }
        continue
      }
      if (config) {
        if ('githubToken' in config) {
          debug(
            `${file} ${
              config?.githubToken ? 'has' : 'does not have'
            } githubToken`
          )
        }
        if ('npmToken' in config) {
          debug(
            `${file} ${config?.npmToken ? 'has' : 'does not have'} npmToken`
          )
        }

        if (!result?.githubToken && config.githubToken) {
          debug(`using githubToken from ${file}`)
          result.githubToken = config.githubToken
        }
        if (!result?.npmToken && config.npmToken) {
          debug(`using npmToken from ${file}`)
          result.npmToken = config.npmToken
        }
      }
    }

    return result
  }
)

export default getConfig
