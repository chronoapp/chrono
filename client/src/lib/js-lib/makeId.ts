import { generate } from 'short-uuid'
import { v4 } from 'uuid'

export function makeShortId(prefix?: string): string {
  return prefix || '' + generate()
}

export function makeUUID(): string {
  return v4()
}
