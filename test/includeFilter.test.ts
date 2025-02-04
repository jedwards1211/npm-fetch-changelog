import { describe, it } from 'mocha'
import { IncludeOption, includeFilter } from '../src/index'
import { expect } from 'chai'

describe(`includeFilter`, function () {
  const testcases: [IncludeOption | null | undefined, [string, boolean][]][] = [
    [
      {
        range: '>=5.0.0',
        minor: false,
        patch: false,
      },
      [
        ['4.0.0', false],
        ['5.0.0', true],
        ['5.0.1', false],
        ['5.1.0', false],
        ['6.0.0', true],
        ['6.0.1', false],
      ],
    ],
  ]

  for (const [include, cases] of testcases) {
    const filter = includeFilter(include)
    describe(JSON.stringify(include), function () {
      for (const [input, expected] of cases) {
        it(`${input} -> ${expected}`, function () {
          expect(filter(input)).to.equal(expected)
        })
      }
    })
  }
})
