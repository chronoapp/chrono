import { immerable } from 'immer'

export default class Contact {
  [immerable] = true

  static fromJson(json): Contact {
    return new Contact(
      json.id,
      json.email,
      json.firstName,
      json.lastName,
      json.photoUrl,
      json.displayName
    )
  }

  constructor(
    readonly id: string,
    readonly email: string,
    readonly firstName: string,
    readonly lastName: string,
    readonly photoUrl: string,
    readonly displayName: string
  ) {}
}
