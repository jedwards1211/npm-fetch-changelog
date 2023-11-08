const versionRx = `\\[?v?\\d+\\.\\d+(\\.\\d+(-[-a-z0-9.]+)?)?\\]?`

export type Release = {
  version: string
  header: string
  body?: string
  date?: Date
  error?: Error
}

export default function parseChangelog(text: string): Record<string, Release> {
  const result: Record<string, Release> = {}
  const versionHeaderRx = new RegExp(
    `^#+\\s+(${versionRx})(.*)$|^(${versionRx})(.*)(\r\n?|\n)(=+|-+)`,
    'mg'
  )
  let match
  let start = 0
  let release: Release | undefined
  while ((match = versionHeaderRx.exec(text))) {
    const rawVersion = match[1] || match[5]
    let version = rawVersion.replace(/\[|\]/g, '')
    if (!match[2] && !match[6]) version += '.0'
    if (release) release.body = text.substring(start, match.index).trim()
    release = {
      version,
      header: match[0],
    }
    result[version] = release
    start = match.index + match[0].length
  }
  if (release) release.body = text.substring(start).trim()

  return result
}
