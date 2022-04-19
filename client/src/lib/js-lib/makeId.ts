import { nanoid } from 'nanoid/non-secure'

export default function makeId(prefix?: string): string {
  return prefix || '' + nanoid()
}
