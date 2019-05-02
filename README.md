# what-broke

[![CircleCI](https://circleci.com/gh/jedwards1211/what-broke.svg?style=svg)](https://circleci.com/gh/jedwards1211/what-broke)
[![Coverage Status](https://codecov.io/gh/jedwards1211/what-broke/branch/master/graph/badge.svg)](https://codecov.io/gh/jedwards1211/what-broke)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/what-broke.svg)](https://badge.fury.io/js/what-broke)

list breaking changes in newer major versions of packages

# How it works

Right now only packages hosted on GitHub are supported. `what-broke` will get
the package info and repository URL from `npm`, then try to fetch and parse the
package's `CHANGELOG.md` or `changelog.md` in the `master` branch.
If no changelog file exists it will try to fetch GitHub releases instead
(which work way better for a tool like this than changelog files, so please use
GitHub releases!)

# GitHub token

GitHub heavily rate limits public API requests, but allows more throughput for
authenticated requests. If you set the `GH_TOKEN` environment variable to a
personal access token, `what-broke` will use it when requesting GitHub releases.

# CLI

```
npm i -g what-broke
```

```
what-broke <package> [<from verison> [<to version>]]
```

Will print out the changelog contents for all major and prerelease versions in
the given range.

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
  }
): Promise<Array<{version: string, body: string}>>
```
