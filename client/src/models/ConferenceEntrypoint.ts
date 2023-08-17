import { immerable } from 'immer'

type EntryPointType = 'video' | 'phone' | 'sip' | 'more'

export default class ConferenceEntryPoint {
  [immerable] = true

  static fromJson(json): ConferenceEntryPoint {
    return new ConferenceEntryPoint(
      json.entry_point_type,
      json.uri,
      json.label,
      json.meeting_code,
      json.password
    )
  }

  constructor(
    readonly entry_point_type: EntryPointType,
    readonly uri: string,
    readonly label: string,
    readonly meeting_code: string | null,
    readonly password: string | null
  ) {}
}
