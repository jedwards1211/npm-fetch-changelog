# npm-fetch-changelog

[![CircleCI](https://circleci.com/gh/jedwards1211/npm-fetch-changelog.svg?style=svg)](https://circleci.com/gh/jedwards1211/npm-fetch-changelog)
[![Coverage Status](https://codecov.io/gh/jedwards1211/npm-fetch-changelog/branch/master/graph/badge.svg)](https://codecov.io/gh/jedwards1211/npm-fetch-changelog)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/npm-fetch-changelog.svg)](https://badge.fury.io/js/npm-fetch-changelog)

fetch the changelog for an npm package from GitHub

# How it works

Right now only packages hosted on GitHub are supported. `npm-fetch-changelog` will get
the package info and repository URL from `npm`, then try to fetch the GitHub
release for each relevant version tag. If no GitHub release is found it will
fall back to trying to parse the package's `CHANGELOG.md` or `changelog.md`.
GitHub releases are way more reliable for this purpose though, so please use
them!

# Caveats

`npm-fetch-changelog` inevitably fails to find changelog entries for some packages/releases
because many maintainers are not very detail-oriented about it (and don't choose
to use excellent tools that would do the work for them, like
[`semantic-release`](https://github.com/semantic-release/semantic-release)).

However, I've also seen cases where some versions were never published to npm
(for instance, at the time of writing, `superagent` version 5.0.0 was never
published to npm, yet it does have a changelog entry). `npm-fetch-changelog` currently
only displays changelog entries for published versions.

# API Tokens

GitHub heavily rate limits public API requests, but allows more throughput for
authenticated requests. If you set the `GH_TOKEN` environment variable to a
personal access token, `npm-fetch-changelog` will use it when requesting GitHub releases.
Otherwise `npm-fetch-changelog` will try to get it from `gh auth token` (`gh` is the GitHub CLI).

`npm-fetch-changelog` will also use the `NPM_TOKEN` environment variable or try to get
the npm token from your `~/.npmrc`, so that it can get information for private
packages you request.

You can also store one or both of these tokesn in `~/.config/npm-fetch-changelog.json`:

```json
{
  "githubToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "npmToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

# CLI

```
npm i -g npm-fetch-changelog
```

```
npm-fetch-changelog <package name>[@<range>]
what-broke <package name>[@<range>]
```

Prints changelog entries fetched from GitHub for each
version released on npm in the given range.

`what-broke` is just a shortcut for `npm-fetch-changelog --no-minor`.

## Options:

### `-r`, `--range`

semver version range to get changelog entries for, e.g. `^7.0.0` (defaults to `>` the version installed in the working directory, if it exists)

You can also pass the range together with the package name (you might need to quote it):

```
npm-fetch-changelog 'foo@>=2'
```

### `--json`

output JSON instead of Markdown

### `--major`

exclude minor and patch versions

### `--minor`

exclude patch versions

### `--pre`

include prerelease versions

# Node.js API

(the CLI just uses this under the hood)

```ts
import { fetchChangelog } from 'npm-fetch-changelog'
```

```ts
async function fetchChangelog(
  package: string,
  options?: {
    include?:
      | (
          | ((version: string) => boolean)
          | {
              range?: ?string
              prerelease?: ?boolean
              minor?: ?boolean
              patch?: ?boolean
            }
        )
      | null
  }
): Promise<
  Record<
    string,
    {
      version: string
      header: string
      body?: string
      date?: Date
      error?: Error
    }
  >
>
```
