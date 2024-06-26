import { ZonedDateTime as DateTime } from '@js-joda/core'
import { formatDateTime } from '@/util/localizer-joda'

import { getLocalStorageItem, setLocalStorageItem } from '@/lib/local-storage'
import Event from '@/models/Event'
import { Label, TimePeriod } from '@/models/Label'
import { LabelRule } from '@/models/LabelRule'
import Calendar from '@/models/Calendar'
import { CalendarProvider } from '@/models/CalendarAccount'

import Contact from '@/models/Contact'
import User from '@/models/User'
import ContactInEvent from '@/models/ContactInEvent'
import Flags from '@/models/Flags'

type SendUpdateType = 'none' | 'all' | 'external'

const BASE_API_URL = process.env.API_URL
const API_URL = `${BASE_API_URL}/api/v1`
export const WEBSOCKET_URL = API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws'

function handleErrors(response: any) {
  if (!response.ok) {
    if (response.status === 401) {
      setLocalStorageItem('auth_token', null)
      window.location.href = '/login'
    } else {
      response.json().then((r: any) => {
        console.log(r)
      })
    }

    throw response
  }
  return response.json()
}

// ================== Authentication ==================

// TODO: Log users out if response is 403.

export function getAuthToken() {
  return getLocalStorageItem('auth_token', '')?.token
}

export function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: getAuthToken(),
  }
}

type AuthType = 'sign_in' | 'add_account'

export function getGoogleOauthUrl(authType: AuthType, userId?: string): string {
  const url = `${API_URL}/oauth/google/auth?auth_type=${authType}`
  if (userId) {
    return `${url}&user_id=${userId}`
  }
  return url
}

export function getZoomOauthUrl(userId: string): string {
  return `${API_URL}/oauth/zoom/auth?user_id=${userId}`
}

export function getMsftOauthUrl(): string {
  return `${API_URL}/oauth/msft/auth`
}

export function loginWithOTP(email: string) {
  return fetch(`${API_URL}/auth/otp/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
    }),
  }).then(handleErrors)
}

export function verifyOTPCode(email: string, code: string) {
  return fetch(`${API_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      code,
    }),
  })
}

export async function authenticateGoogleOauth(code: string, state: string) {
  return fetch(`${API_URL}/oauth/google/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state,
    }),
  }).then(handleErrors)
}

// ================== User Info ==================

export async function getUser(): Promise<User> {
  return fetch(`${API_URL}/user/`, {
    method: 'GET',
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => User.fromJson(resp))
}

export async function updateUser(user: User): Promise<User> {
  const userUpdate = {
    name: user.name,
    username: user.username,
    timezones: user.timezones,
    default_calendar_id: user.defaultCalendarId,
  }

  return fetch(`${API_URL}/user/`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(userUpdate),
  })
    .then(handleErrors)
    .then((resp) => User.fromJson(resp))
}

export async function updateUserFlags(
  flagType: string,
  flagValue: boolean | string
): Promise<Flags> {
  return fetch(`${API_URL}/user/flags/`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      flag: flagType,
      value: flagValue,
    }),
  })
    .then(handleErrors)
    .then(Flags.fromJson)
}

export async function removeUserAccount(accountId: string) {
  return fetch(`${API_URL}/user/accounts/${accountId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  }).then(handleErrors)
}

export async function removeZoomConnection() {
  return fetch(`${API_URL}/user/zoom-connection/`, {
    method: 'DELETE',
    headers: getHeaders(),
  }).then(handleErrors)
}

// ================== Calendars ==================

export async function createCalendar(
  account_id: string,
  summary: string,
  foregroundColor: string,
  backgroundColor: string,
  source: CalendarProvider,
  description: string,
  timezone?: string
): Promise<Calendar> {
  return fetch(`${API_URL}/calendars/`, {
    method: 'POST',
    body: JSON.stringify({
      account_id,
      summary,
      description,
      timezone,
      foregroundColor,
      backgroundColor,
      source,
    }),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      return Calendar.fromJson(resp)
    })
}

export async function getCalendars(): Promise<Calendar[]> {
  return fetch(`${API_URL}/calendars/`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((calendarJson: any) => Calendar.fromJson(calendarJson))
    })
}

export async function putCalendar(calendar: Calendar): Promise<Calendar> {
  return fetch(`${API_URL}/calendars/${calendar.id}`, {
    method: 'PUT',
    body: JSON.stringify(calendar),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      return Calendar.fromJson(resp)
    })
}

export async function deleteCalendar(calendarId: string) {
  return fetch(`${API_URL}/calendars/${calendarId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  }).then(handleErrors)
}

// ================== Events ==================

export async function getCalendarEvents(
  calendarId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<Event[]> {
  const params = {
    start_date: startDate,
    end_date: endDate,
  }
  var queryString = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => key + '=' + encodeURIComponent(params[key]))
    .join('&')

  return fetch(`${API_URL}/calendars/${calendarId}/events/?${queryString}`, {
    signal,
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => Event.fromJson(calendarId, eventJson))
    })
}

export async function getEvent(calendarId: string, eventId: string): Promise<Event> {
  return fetch(`${API_URL}/calendars/${calendarId}/events/${eventId}`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      return Event.fromJson(calendarId, resp)
    })
}

/**
 * Creates a new event on the given calendar.
 *
 * The timezone parameter is used to convert the event response to a user-selected
 * timezone. It is not used to set the timezone of the event.
 *
 */
export async function createEvent(
  calendarId: string,
  event: Event,
  sendUpdates: boolean
): Promise<Event> {
  const sendUpdateType = sendUpdates ? 'all' : 'none'

  return fetch(`${API_URL}/calendars/${calendarId}/events/?sendUpdateType=${sendUpdateType}`, {
    method: 'POST',
    headers: getHeaders(),
    body: eventToJSON(event),
  })
    .then(handleErrors)
    .then((resp) => Event.fromJson(calendarId, resp))
}

export async function updateEvent(
  calendarId: string,
  event: Partial<Event>,
  sendUpdates: boolean
): Promise<Event> {
  const sendUpdateType = sendUpdates ? 'all' : 'none'

  return fetch(
    `${API_URL}/calendars/${calendarId}/events/${event.id}?sendUpdateType=${sendUpdateType}`,
    {
      method: 'PUT',
      headers: getHeaders(),
      body: eventToJSON(event),
    }
  )
    .then(handleErrors)
    .then((resp) => Event.fromJson(calendarId, resp))
}

export async function moveEvent(
  eventId: string,
  fromCalendarId: string,
  toCalendarId: string,
  sendUpdates: boolean
): Promise<Event> {
  const sendUpdateType = sendUpdates ? 'all' : 'none'

  return fetch(
    `${API_URL}/calendars/${fromCalendarId}/events/${eventId}/move?sendUpdateType=${sendUpdateType}`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ calendar_id: toCalendarId }),
    }
  )
    .then(handleErrors)
    .then((resp) => Event.fromJson(toCalendarId, resp))
}

export async function deleteEvent(
  calendarId: string,
  eventId: string,
  sendUpdates: boolean
): Promise<{}> {
  const sendUpdateType = sendUpdates ? 'all' : 'none'

  return fetch(
    `${API_URL}/calendars/${calendarId}/events/${eventId}?sendUpdateType=${sendUpdateType}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    }
  ).then(handleErrors)
}

export async function searchEvents(query: string): Promise<Event[]> {
  return fetch(`${API_URL}/events/?query=${query}`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => {
      // TODO: Index by calendar ID
      return resp.map((eventJson: any) => Event.fromJson(eventJson.calendar_id, eventJson))
    })
}

// ================== Labels ==================

export async function getLabels(title: string = ''): Promise<Label[]> {
  return fetch(`${API_URL}/labels/?title=${title}`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => resp.map((label: any) => Label.fromJson(label)))
}

export async function createLabel(title: string, colorHex: string): Promise<Label> {
  const label = {
    title: title,
    color_hex: colorHex,
    position: 0,
  }

  return fetch(`${API_URL}/labels/`, {
    method: 'POST',
    body: JSON.stringify(label),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabel(label: Label): Promise<Label> {
  return fetch(`${API_URL}/labels/${label.id}`, {
    method: 'PUT',
    body: JSON.stringify(label),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function deleteLabel(labelId: string): Promise<Label> {
  return fetch(`${API_URL}/labels/${labelId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabels(labels: Label[]): Promise<Label[]> {
  return fetch(`${API_URL}/labels/`, {
    method: 'PUT',
    body: JSON.stringify(labels),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((labels) => labels.map((label) => Label.fromJson(label)))
}

// Label Rules

export async function getLabelRules(labelText: string, labelId: string): Promise<LabelRule[]> {
  return fetch(`${API_URL}/label_rules/?text=${labelText}&label_id=${labelId}`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => resp.map((rule: any) => LabelRule.fromJson(rule)))
}

export async function putLabelRule(labelRule: LabelRule): Promise<LabelRule> {
  return fetch(`${API_URL}/label_rules/`, {
    method: 'PUT',
    body: JSON.stringify(labelRule),
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then(LabelRule.fromJson)
}

// Contacts

export async function getContacts(query?: string, limit?: number): Promise<Contact[]> {
  return fetch(`${API_URL}/contacts/?query=${query || ''}&limit=${limit || 10}`, {
    method: 'GET',
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => resp.map((contact) => Contact.fromJson(contact)))
}

export async function getContact(contactId: string): Promise<Contact> {
  return fetch(`${API_URL}/contacts/${contactId}`, {
    method: 'GET',
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => Contact.fromJson(resp))
}

// ================== Plugins: Trends ==================

export async function getTrends(
  labelId: string,
  timePeriod: TimePeriod,
  start: DateTime,
  end: DateTime
) {
  const params = {
    start: formatDateTime(start),
    end: formatDateTime(end),
    time_period: timePeriod,
  }
  const queryString = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => key + '=' + encodeURIComponent(params[key]))
    .join('&')

  return fetch(`${API_URL}/plugins/trends/${labelId}?${queryString}`, {
    headers: getHeaders(),
  }).then(handleErrors)
}

// ================== Plugins: Contacts In Event ==================

export async function getContactsInEvent(): Promise<ContactInEvent[]> {
  return fetch(`${API_URL}/plugins/people/`, {
    headers: getHeaders(),
  })
    .then(handleErrors)
    .then((resp) => resp.map((contactInEventJSON) => ContactInEvent.fromJson(contactInEventJSON)))
}

/**
 *
 * Converts an event object to a JSON string to be consumed by the API.
 * The start and end fields are converted to a string in ISO 8601 format.
 *
 */
function eventToJSON(event: Partial<Event>) {
  const jsonEvent = {
    ...event,
    start: formatDateTime(event.start!),
    end: formatDateTime(event.end!),
    original_start: event.original_start ? formatDateTime(event.original_start) : null,
  }

  return JSON.stringify(jsonEvent)
}
