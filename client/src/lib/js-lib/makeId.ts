import shortUUID from 'short-uuid'
import { v4 } from 'uuid'

// This alphabet contains 57 characters and excludes characters that can be easily confused, such as 0, O, 1, and I.
// Equivalent to python's shortuuid.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function makeShortId(prefix?: string): string {
  const uuid = shortUUID(ALPHABET)

  return prefix || '' + uuid.new()
}

export function makeUUID(): string {
  return v4()
}
