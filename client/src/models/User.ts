/**
 * User information, including settings.
 */
export default class User {
  static fromJson(userJson: any) {
    return new User(userJson.email, userJson.timezone)
  }

  constructor(readonly email: string, readonly timezone: string) {}
}
