// @flow

import os from 'os'
import * as fs from 'fs-extra'
import once from './util/once'

const getNpmToken = once(
  async (env: { [name: string]: ?string } = process.env): Promise<?string> => {
    const { NPM_TOKEN } = env
    if (NPM_TOKEN) return NPM_TOKEN
    try {
      const homedir = os.homedir()
      const npmrc = await fs.readFile(`${homedir}/.npmrc`, 'utf8')
      const match = /:_authToken=([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})/.exec(
        npmrc
      )
      if (match) return match[1]
    } catch (error) {
      return null
    }
  }
)
export default getNpmToken
