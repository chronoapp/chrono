import Contact from './Contact'

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

  static fromContact(contact: Contact) {
    return new EventParticipant(
      undefined,
      contact.email,
      contact.id,
      'needsAction',
      contact.displayName,
      contact.photoUrl,
      null
    )
  }

  static fromEmail(email: string) {
    return new EventParticipant(undefined, email, undefined, 'needsAction', null, null, null)
  }

  static fromCreatorOrOrganizer(email: string, displayName: string) {
    return new EventParticipant(undefined, email, undefined, undefined, displayName)
  }

  static getMutableFields(participant: Partial<EventParticipant>) {
    return {
      email: participant.email,
      contact_id: participant.contact_id,
    }
  }

  public equals(other: Partial<EventParticipant>): boolean {
    return (
      (!!this.id && this.id === other.id) ||
      (!!this.email && this.email === other.email) ||
      (!!this.contact_id && this.contact_id === other.contact_id)
    )
  }
}
