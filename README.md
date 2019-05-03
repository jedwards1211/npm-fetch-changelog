# what-broke

[![CircleCI](https://circleci.com/gh/jedwards1211/what-broke.svg?style=svg)](https://circleci.com/gh/jedwards1211/what-broke)
[![Coverage Status](https://codecov.io/gh/jedwards1211/what-broke/branch/master/graph/badge.svg)](https://codecov.io/gh/jedwards1211/what-broke)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/what-broke.svg)](https://badge.fury.io/js/what-broke)

list breaking changes in newer major versions of packages

# How it works

Right now only packages hosted on GitHub are supported. `what-broke` will get
the package info and repository URL from `npm`, then try to fetch the GitHub
release for each relevant version tag. If no GitHub release is found it will
fall back to trying to parse the package's `CHANGELOG.md` or `changelog.md`.
GitHub releases are way more reliable for this purpose though, so please use
them!

# Caveats

`what-broke` inevitably fails to find changelog entries for some packages/releases
because many maintainers are not very detail-oriented about it (and don't choose
to use excellent tools that would do the work for them, like
[`semantic-release`](https://github.com/semantic-release/semantic-release)).

However, I've also seen cases where some versions were never published to npm
(for instance, at the time of writing, `superagent` version 5.0.0 was never
published to npm, yet it does have a changelog entry). `what-broke` currently
only displays changelog entries for published versions.

# API Tokens

GitHub heavily rate limits public API requests, but allows more throughput for
authenticated requests. If you set the `GH_TOKEN` environment variable to a
personal access token, `what-broke` will use it when requesting GitHub releases.

`what-broke` will also use the `NPM_TOKEN` environment variable or try to get
the npm token from your `~/.npmrc`, so that it can get information for private
packages you request.

# CLI

```
npm i -g what-broke
```

```
what-broke <package> [--full] [<from verison> [<to version>]]
```

Will print out the changelog contents for all major and prerelease versions in
the given range. (If `--full` is given, it will also include minor and patch
versions.)

If `package` is installed in the current working directory, `<from version>`
will default to the installed version.

# Node.js API

(the CLI just uses this under the hood)

```js
import whatBroke from 'what-broke'
```

```js
async function whatBroke(
  package: string,
  options?: {
    fromVersion?: ?string,
    toVersion?: ?string,
    full?: ?boolean,
  }
): Promise<Array<{version: string, body: string}>>
```
