import Flags from './Flags'
import CalendarAccount from './CalendarAccount'
import ZoomConnection from './ZoomConnection'

export type VideoMeetType = 'google' | 'zoom' | 'other'

/**
 * User information, including settings.
 */
export default class User {
  static fromJson(userJson: any) {
    return new User(
      userJson.id,
      userJson.email,
      userJson.timezones,
      Flags.fromJson(userJson.flags),
      userJson.picture_url,
      userJson.name,
      userJson.username,
      userJson.default_calendar_id,
      userJson.accounts.map((accountJson: any) => CalendarAccount.fromJson(accountJson)),
      userJson.zoom_connection ? ZoomConnection.fromJson(userJson.zoom_connection) : null
    )
  }

  static getVideoMeetTypes(user: User) {
    const conferenceTypes: VideoMeetType[] = ['google']

    if (user.zoomConnection) {
      conferenceTypes.push('zoom')
    }

    return conferenceTypes
  }

  static getPrimaryTimezone(user: User | undefined) {
    if (!user || user.timezones.length === 0) {
      return 'local'
    }

    return user.timezones[0]
  }

  constructor(
    readonly id: string,
    readonly email: string,
    readonly timezones: string[],
    readonly flags: Flags,
    readonly picture_url: string,
    readonly name: string,
    readonly username: string,
    readonly defaultCalendarId: string,
    readonly accounts: CalendarAccount[],
    readonly zoomConnection: ZoomConnection | null
  ) {}
}
