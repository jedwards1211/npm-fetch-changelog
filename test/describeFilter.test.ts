import { describe, it } from 'mocha'
import { expect } from 'chai'
import { describeFilter } from '../src'
import chalk from 'chalk'

describe(`describeFilter`, function () {
  for (const [input, expected] of [
    [{}, 'all major, minor and patch versions'],
    [
      { highlight: true },
      chalk`{greenBright all} major, minor and patch versions`,
    ],
    [{ pkg: 'foo' }, 'all major, minor and patch versions of foo'],
    [
      { pkg: 'foo', highlight: true },
      chalk`{greenBright all} major, minor and patch versions of {bold foo}`,
    ],
    [{ include: { range: '>5' } }, 'major, minor and patch versions >5'],
    [
      { pkg: 'foo', include: { range: '>5' } },
      'major, minor and patch versions of foo >5',
    ],
    [
      { pkg: 'foo', include: { range: '>5' }, highlight: true },
      chalk`major, minor and patch versions of {bold foo} {greenBright >5}`,
    ],
    [{ include: { range: '>=5' } }, 'major, minor and patch versions >=5'],
    [{ include: { range: '<5' } }, 'major, minor and patch versions <5'],
    [{ include: { range: '<=5' } }, 'major, minor and patch versions <=5'],
    [
      { include: { range: '^5.3' } },
      'major, minor and patch versions satisfying ^5.3',
    ],
    [
      { pkg: 'foo', include: { range: '^5.3' } },
      'major, minor and patch versions of foo satisfying ^5.3',
    ],
    [
      { include: { range: '~5.3' } },
      'major, minor and patch versions satisfying ~5.3',
    ],
    [{ include: { minor: false } }, 'all major and patch versions'],
    [{ include: { patch: false } }, 'all major and minor versions'],
    [{ include: { minor: false, patch: false } }, 'all major versions'],
    [
      { include: { patch: false, prerelease: true } },
      'all prerelease, major and minor versions',
    ],
  ] as const) {
    it(`${JSON.stringify(input)} -> ${expected}`, function () {
      expect(describeFilter(input)).to.equal(expected)
    })
  }
})
