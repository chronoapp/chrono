export type CalendarProvider = 'google' | 'chrono'

export default class CalendarAccount {
  static fromJson(json: any) {
    return new CalendarAccount(json.id, json.email, json.provider, json.is_default)
  }

  constructor(
    readonly id: string,
    readonly email: string,
    readonly provider: CalendarProvider,
    readonly isDefault: boolean
  ) {}

  get providerName() {
    if (this.provider === 'google') {
      return 'Google'
    } else if (this.provider === 'chrono') {
      return 'Chrono'
    } else {
      throw new Error('Invalid provider')
    }
  }
}
