type ReminderMethod = 'email' | 'popup' | 'sms'

export default class ReminderOverride {
  static fromJson(reminderJson: any) {
    return new ReminderOverride(reminderJson.method, reminderJson.minutes)
  }

  constructor(readonly method: ReminderMethod, readonly minutes: number) {}
}
