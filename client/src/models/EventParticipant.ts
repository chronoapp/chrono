export type ResponseStatus = 'needsAction' | 'accepted' | 'declined' | 'tentative'

export default class EventParticipant {
  constructor(
    readonly id: string | undefined,
    readonly email?: string,
    readonly contact_id?: string,
    readonly response_status?: ResponseStatus,
    readonly display_name?: string | null,
    readonly photo_url?: string | null,
    readonly is_self?: boolean | null
  ) {}

  static fromJson(json: any): EventParticipant {
    return new EventParticipant(
      json.id,
      json.email,
      json.contact_id,
      json.response_status,
      json.display_name,
      json.photo_url,
      json.is_self
    )
  }

  static fromCreatorOrOrganizer(email: string, displayName: string) {
    return new EventParticipant(undefined, email, undefined, undefined, displayName)
  }

  public static getMutableFields(participant: Partial<EventParticipant>) {
    return {
      email: participant.email,
      contact_id: participant.contact_id,
    }
  }
}
