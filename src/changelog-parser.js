// @flow

const versionRx = `v?\\d+\\.\\d+\\.\\d+(-[-a-z0-9.]+)?`

export type Release = {
  version: string,
  body?: string,
  date?: Date,
  error?: Error,
}

export default function parseChangelog(text: string): { [string]: Release } {
  const result = {}
  const versionHeaderRx = new RegExp(
    `^#+\\s+(${versionRx})(.*)$|^(${versionRx})(.*)(\r\n?|\n)(=+|-+)`,
    'mg'
  )
  let match
  let start = 0
  let release: ?Release
  while ((match = versionHeaderRx.exec(text))) {
    // console.log(match)
    const version = match[1] || match[4]
    if (release) release.body = text.substring(start, match.index).trim()
    release = { version }
    result[version] = release
    start = match.index + match[0].length
  }
  if (release) release.body = text.substring(start).trim()

  return result
}
