export default function memoize<Args extends any[], Ret>(
  fn: (...args: Args) => Ret,
  resolver: (...args: Args) => any = ((first: unknown) => String(first)) as any
): (...args: Args) => Ret {
  const cache = new Map()
  return (...args: Args): Ret => {
    const key = resolver(...args)
    if (cache.has(key)) return cache.get(key)
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}
