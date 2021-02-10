/**
 * @flow
 * @prettier
 */

export default function memoize<F: (...args: any[]) => any>(
  fn: F,
  resolver?: (...args: any[]) => any = (first) => String(first)
): F {
  const cache = new Map()
  return ((...args: any[]): any => {
    const key = resolver(...args)
    if (cache.has(key)) return cache.get(key)
    const result = fn(...args)
    cache.set(key, result)
    return result
  }: any)
}
