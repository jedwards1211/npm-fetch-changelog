/**
 * @flow
 * @prettier
 */

export default function once<F: (...any[]) => any>(fn: F): F {
  let result: any
  let called = false
  return ((...args: Array<any>): any => {
    if (called) return result
    called = true
    return (result = fn(...args))
  }: any)
}
