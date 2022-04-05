import Router from 'next/router'
import Cookies from 'universal-cookie'

import { formatDateTime } from '@/util/localizer'
import Event from '@/models/Event'
import { Label, TimePeriod } from '@/models/Label'
import { LabelRule } from '@/models/LabelRule'
import Calendar, { CalendarSource } from '@/models/Calendar'
import Contact from '@/models/Contact'

const API_URL = '/api/v1'

function handleErrors(response: any) {
  if (!response.ok) {
    if (response.status === 401) {
      new Cookies().set('auth_token', null)
      Router.push('/login')
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

export function auth(ctx) {
  let token
  if (ctx.req) {
    const cookies = new Cookies(ctx.req.headers.cookie)
    token = cookies.get('auth_token')

    if (!token) {
      ctx.res.writeHead(302, { Location: '/login' })
      ctx.res.end()
      return
    }
  } else {
    let cookies = new Cookies()
    token = cookies.get('auth_token')
  }

  if (!token) {
    Router.push('/login')
  }

  return token
}

export function getAuthToken(req?: any) {
  let cookies
  if (req != null) {
    cookies = new Cookies(req.headers.cookie)
  } else {
    cookies = new Cookies()
  }

  return cookies.get('auth_token') || ''
}

export function getHeaders(authToken: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: authToken,
  }
}

export function getGoogleOauthUrl(): string {
  return `${API_URL}/oauth/google/auth`
}

export function getMsftOauthUrl(): string {
  return `${API_URL}/oauth/msft/auth`
}

export function loginWithEmail(email: string, password: string) {
  return fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  }).then(handleErrors)
}

export function signOut() {
  // TODO: Update state after this.
  const cookies = new Cookies()
  cookies.remove('auth_token')

  Router.push('/login')
  Router.reload()
}

export async function authenticate(code: string, state: string) {
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

// ================== Calendars ==================

export async function createCalendar(
  authToken: string,
  summary: string,
  backgroundColor: string,
  source: CalendarSource,
  description: string,
  timezone?: string,
  foregroundColor: string = '#ffffff'
): Promise<Calendar> {
  return fetch(`${API_URL}/calendars/`, {
    method: 'POST',
    body: JSON.stringify({
      summary,
      description,
      timezone,
      backgroundColor,
      source,
      foregroundColor,
    }),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      return Calendar.fromJson(resp)
    })
}

export async function getCalendars(authToken: string): Promise<Calendar[]> {
  return fetch(`${API_URL}/calendars/`, {
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((calendarJson: any) => Calendar.fromJson(calendarJson))
    })
}

export async function putCalendar(calendar: Calendar, authToken: string): Promise<Calendar> {
  return fetch(`${API_URL}/calendars/${calendar.id}`, {
    method: 'PUT',
    body: JSON.stringify(calendar),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      return Calendar.fromJson(resp)
    })
}

export async function deleteCalendar(calendarId: string, authToken: string) {
  return fetch(`${API_URL}/calendars/${calendarId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  }).then(handleErrors)
}

// ================== Events ==================

export async function getAllEvents(
  authToken: string,
  start: Date,
  end: Date,
  calendars: Calendar[]
) {
  const eventPromises = calendars
    .filter((cal) => cal.selected)
    .map((calendar) => {
      try {
        return {
          eventsPromise: getCalendarEvents(
            authToken,
            calendar.id,
            formatDateTime(start),
            formatDateTime(end)
          ),
          calendarId: calendar.id,
        }
      } catch (err) {
        return { eventsPromise: Promise.resolve([]), calendarId: calendar.id }
      }
    })

  const records: Record<string, Event[]> = {}
  for (const e of eventPromises) {
    records[e.calendarId] = await e.eventsPromise
  }

  return records
}

export async function getCalendarEvents(
  authToken: string,
  calendarId: string,
  startDate: string,
  endDate: string
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
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => Event.fromJson(calendarId, eventJson))
    })
}

export async function getEvent(
  authToken: string,
  calendarId: string,
  eventId: string
): Promise<Event> {
  return fetch(`${API_URL}/calendars/${calendarId}/events/${eventId}`, {
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      return Event.fromJson(calendarId, resp)
    })
}

export async function createEvent(
  authToken: string,
  calendarId: string,
  event: Event
): Promise<Event> {
  return fetch(`${API_URL}/calendars/${calendarId}/events/`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(event),
  })
    .then(handleErrors)
    .then((resp) => Event.fromJson(calendarId, resp))
}

export async function updateEvent(
  authToken: string,
  calendarId: string,
  event: Partial<Event>
): Promise<Event> {
  return fetch(`${API_URL}/calendars/${calendarId}/events/${event.id}`, {
    method: 'PUT',
    headers: getHeaders(authToken),
    body: JSON.stringify(event),
  })
    .then(handleErrors)
    .then((resp) => Event.fromJson(calendarId, resp))
}

export async function deleteEvent(
  authToken: string,
  calendarId: string,
  eventId: string
): Promise<{}> {
  return fetch(`${API_URL}/calendars/${calendarId}/events/${eventId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
    body: JSON.stringify(event),
  }).then(handleErrors)
}

export async function searchEvents(authToken: string, query: string): Promise<Event[]> {
  return fetch(`${API_URL}/events/?query=${query}`, {
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => {
      // TODO: Index by calendar ID
      return resp.map((eventJson: any) => Event.fromJson(eventJson.calendar_id, eventJson))
    })
}

// ================== Trends and Stats ==================

export async function getTrends(
  labelId: number,
  authToken: string,
  timePeriod: TimePeriod,
  start: Date,
  end: Date
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

  return fetch(`${API_URL}/trends/${labelId}?${queryString}`, {
    headers: getHeaders(authToken),
  }).then(handleErrors)
}

// Labels

export async function getLabels(authToken: string, title: string = ''): Promise<Label[]> {
  return fetch(`${API_URL}/labels/?title=${title}`, {
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => resp.map((label: any) => Label.fromJson(label)))
}

export async function createLabel(
  title: string,
  colorHex: string,
  authToken: string
): Promise<Label> {
  const label = {
    title: title,
    color_hex: colorHex,
    position: 0,
  }

  return fetch(`${API_URL}/labels/`, {
    method: 'POST',
    body: JSON.stringify(label),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabel(label: Label, authToken: string): Promise<Label> {
  return fetch(`${API_URL}/labels/${label.id}`, {
    method: 'PUT',
    body: JSON.stringify(label),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function deleteLabel(labelId: number, authToken: string): Promise<Label> {
  return fetch(`${API_URL}/labels/${labelId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabels(labels: Label[], authToken: string): Promise<Label[]> {
  return fetch(`${API_URL}/labels/`, {
    method: 'PUT',
    body: JSON.stringify(labels),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((labels) => labels.map((label) => Label.fromJson(label)))
}

// Label Rules

export async function getLabelRules(
  labelText: string,
  labelId: number,
  authToken: string
): Promise<LabelRule[]> {
  return fetch(`${API_URL}/label_rules/?text=${labelText}&label_id=${labelId}`, {
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => resp.map((rule: any) => LabelRule.fromJson(rule)))
}

export async function putLabelRule(labelRule: LabelRule, authToken: string): Promise<LabelRule> {
  return fetch(`${API_URL}/label_rules/`, {
    method: 'PUT',
    body: JSON.stringify(labelRule),
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then(LabelRule.fromJson)
}

export async function syncCalendar(authToken: string) {
  return fetch(`${API_URL}/sync/`, {
    method: 'POST',
    headers: getHeaders(authToken),
  }).then(handleErrors)
}

// Contacts

export async function getContacts(
  authToken: string,
  query?: string,
  limit?: number
): Promise<Contact[]> {
  return fetch(`${API_URL}/contacts/?query=${query || ''}&limit=${limit || 10}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => resp.map((contact) => Contact.fromJson(contact)))
}

export async function getContact(authToken: string, contactId: string): Promise<Contact> {
  return fetch(`${API_URL}/contacts/${contactId}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  })
    .then(handleErrors)
    .then((resp) => Contact.fromJson(resp))
}
