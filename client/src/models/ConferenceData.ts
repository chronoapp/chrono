import { immerable } from 'immer'
import ConferenceEntryPoint from './ConferenceEntrypoint'

export type ConferenceKeyType =
  | 'eventHangout'
  | 'eventNamedHangout'
  | 'hangoutsMeet'
  | 'addOn'
  | 'zoom'

export type ConferenceCreateStatus = 'pending' | 'success' | 'failure'

export class CreateRequest {
  [immerable] = true

  static fromJson(json): CreateRequest {
    return new CreateRequest(json.conference_solution_key_type, json.status)
  }

  constructor(
    readonly conference_solution_key_type: ConferenceKeyType,
    readonly status: ConferenceCreateStatus
  ) {}
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
      json.create_request ? CreateRequest.fromJson(json.create_request) : null
    )
  }

  static newHangoutsMeet(): ConferenceData {
    return new ConferenceData(null, null, [], new CreateRequest('hangoutsMeet', 'pending'))
  }

  static newZoomMeet(): ConferenceData {
    return new ConferenceData(null, null, [], new CreateRequest('zoom', 'pending'))
  }

  constructor(
    readonly conference_id: string | null,
    readonly conference_solution: ConferenceSolution | null,
    readonly entry_points: ConferenceEntryPoint[],
    readonly create_request: CreateRequest | null
  ) {}
}
