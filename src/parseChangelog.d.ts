export type Release = {
  version: string
  header: string
  body?: string
  date?: Date
  error?: Error
}

export default function parseChangelog(text: string): Record<string, Release>
