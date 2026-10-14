/** Tiny argument helpers shared by the CLI wrappers in scripts/. */

export function fail(script: string, message: string): never {
  console.error(`${script}: ${message}`)
  process.exit(1)
}

/** Read the value after a flag anywhere in args; fails when missing. */
export function flagValue(script: string, args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return fail(script, `missing value for ${flag}`)
  }
  return value
}

/** Read the value after args[index]; fails when missing. */
export function valueAfter(script: string, args: string[], index: number, flag: string): string {
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return fail(script, `missing value for ${flag}`)
  }
  return value
}
