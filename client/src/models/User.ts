import Flags from './Flags'

/**
 * User information, including settings.
 */
export default class User {
  static fromJson(userJson: any) {
    return new User(
      userJson.id,
      userJson.email,
      userJson.timezone,
      Flags.fromJson(userJson.flags),
      userJson.picture_url,
      userJson.name,
      userJson.username
    )
  }

  constructor(
    readonly id: string,
    readonly email: string,
    readonly timezone: string,
    readonly flags: Flags,
    readonly picture_url: string,
    readonly name: string,
    readonly username: string
  ) {}
}
