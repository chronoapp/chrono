import { immerable } from 'immer'
import ConferenceEntryPoint from './ConferenceEntrypoint'

export type ConferenceKeyType = 'eventHangout' | 'eventNamedHangout' | 'hangoutsMeet' | 'addOn'

export class CreateRequest {
  [immerable] = true

  constructor(readonly conference_solution_key: ConferenceKeyType) {}
}

export class ConferenceSolution {
  [immerable] = true

  static fromJson(json): ConferenceSolution {
    return new ConferenceSolution(json.key_type, json.name, json.icon_uri)
  }

  constructor(
    readonly key_type: ConferenceKeyType,
    readonly name: string,
    readonly icon_uri: string
  ) {}
}

export default class ConferenceData {
  [immerable] = true

  static fromJson(json): ConferenceData {
    return new ConferenceData(
      json.conference_id,
      json.conference_solution ? ConferenceSolution.fromJson(json.conference_solution) : null,
      json.entry_points.map((entryPointJson) => ConferenceEntryPoint.fromJson(entryPointJson)),
      null
    )
  }

  static newHangoutsMeet(): ConferenceData {
    return new ConferenceData(null, null, [], new CreateRequest('hangoutsMeet'))
  }

  constructor(
    readonly conference_id: string | null,
    readonly conference_solution: ConferenceSolution | null,
    readonly entry_points: ConferenceEntryPoint[],
    readonly create_request: CreateRequest | null
  ) {}
}
