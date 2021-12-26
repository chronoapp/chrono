import { nanoid } from 'nanoid'

export default function makeId(prefix?: string): string {
  return prefix || '' + nanoid()
}
