export default class CalendarAccount {
  static fromJson(json: any) {
    return new CalendarAccount(json.id, json.email)
  }

  constructor(readonly id: string, readonly email: string) {}
}
