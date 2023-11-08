export default function once<Args extends any[], Ret>(
  fn: (...args: Args) => Ret
): (...args: Args) => Ret {
  let result: [Ret] | undefined
  return (...args: Args) => (result ||= [fn(...args)])[0]
}
