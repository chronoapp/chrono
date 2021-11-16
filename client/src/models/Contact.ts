import { immerable } from 'immer'

export default class Contact {
  [immerable] = true

  static fromJson(json): Contact {
    return new Contact(json.id, json.emailAddress, json.firstName, json.lastName, json.photoUrl)
  }

  get fullName(): string {
    if (!this.firstName && !this.lastName) {
      return ''
    }

    if (this.firstName && !this.lastName) {
      return this.firstName
    }

    if (this.lastName && !this.firstName) {
      return this.lastName
    }

    return `${this.firstName} ${this.lastName}`
  }

  constructor(
    readonly id: string,
    readonly emailAddress: string,
    readonly firstName: string,
    readonly lastName: string,
    readonly photoUrl: string
  ) {}
}
