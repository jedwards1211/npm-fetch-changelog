#!/usr/bin/env node

import { spawn } from 'child_process'

const child = spawn(
  process.execPath,
  [
    require.resolve('./npm-fetch-changelog.js'),
    ...process.argv.slice(2),
    '--no-minor',
  ],
  {
    stdio: 'inherit',
  }
)
child.on('error', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error(error.stack)
  process.exit(1)
})
child.on('close', (code?: number, signal?: string) => {
  if (code != null) process.exit(code)
  process.exit(signal ? 1 : 0)
})
