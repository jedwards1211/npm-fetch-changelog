import { Release } from './parseChangelog'

export function getChangelogFromFile(
  owner: string,
  repo: string
): Promise<Record<string, Release>>

export type IncludeOption =
  | ((version: string) => boolean)
  | {
      range?: string
      prerelease?: boolean
      minor?: boolean
      patch?: boolean
    }

export type Options = {
  include?: IncludeOption
}

export function fetchChangelog(
  pkg: string,
  options?: Options
): Promise<Record<string, Release>>
