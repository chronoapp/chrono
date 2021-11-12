import { immerable } from 'immer'

export default class Contact {
    [immerable] = true
  
    static fromJson(json): Contact {
      return new Contact(
        json.id,
        json.emailAddress,
        json.firstName,
        json.lastName,
      )
    }
  
    constructor(
      readonly id: string,
      readonly emailAddress: string,
      readonly firstName: string,
      readonly lastName: string,
      readonly displayName: string = `${firstName} ${lastName}`,
    ) {}
}
  