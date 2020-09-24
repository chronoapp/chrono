import Router from 'next/router'
import Cookies from 'universal-cookie'
import Event from '../models/Event'
import { Label, TimePeriod } from '../models/Label'
import { LabelRule } from '../models/LabelRule'
import Calendar from '../models/Calendar'
import { formatDateTime } from '../util/localizer'

const API_URL = 'http://localhost:8888/api/v1'

function handleErrors(response: any) {
  if (!response.ok) {
    response.json().then((r: any) => {
      console.log(r)
    })

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

export function getOauthUrl(): string {
  return `${API_URL}/oauth/google/auth`
}

export function signOut() {
  // TODO: Update state after this.
  const cookies = new Cookies()
  cookies.remove('auth_token')

  Router.push('/login')
}

export async function authenticate(code: string, state: string) {
  return fetch(`${API_URL}/oauth/google/token`, {
    method: 'POST',
    body: JSON.stringify({
      code,
      state,
    }),
  }).then(handleErrors)
}

export async function getCalendars(authToken: string): Promise<Calendar[]> {
  return fetch(`${API_URL}/calendars/`, {
    headers: { Authorization: authToken },
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
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => {
      return Calendar.fromJson(resp)
    })
}

export async function getEvents(
  authToken: string,
  title: string = '',
  startDate?: string,
  endDate?: string,
  limit: number = 250
): Promise<Event[]> {
  const params = {
    title,
    start_date: startDate,
    end_date: endDate,
    limit,
  }
  var queryString = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => key + '=' + params[key])
    .join('&')

  return fetch(`${API_URL}/events/?${queryString}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => Event.fromJson(eventJson))
    })
}

export async function createEvent(authToken: string, event: Event): Promise<Event> {
  return fetch(`${API_URL}/events/`, {
    method: 'POST',
    headers: { Authorization: authToken },
    body: JSON.stringify(event),
  })
    .then(handleErrors)
    .then((resp) => Event.fromJson(resp))
}

export async function updateEvent(authToken: string, event: Event): Promise<Event> {
  return fetch(`${API_URL}/events/${event.id}`, {
    method: 'PUT',
    headers: { Authorization: authToken },
    body: JSON.stringify(event),
  })
    .then(handleErrors)
    .then((resp) => Event.fromJson(resp))
}

export async function deleteEvent(authToken: string, eventId: number): Promise<{}> {
  return fetch(`${API_URL}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: authToken },
    body: JSON.stringify(event),
  }).then(handleErrors)
}

export async function searchEvents(authToken: string, query: string): Promise<Event[]> {
  return fetch(`${API_URL}/events/?query=${query}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => Event.fromJson(eventJson))
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
  return fetch(
    `${API_URL}/trends/${labelId}?time_period=${timePeriod}&start=${formatDateTime(
      start
    )}&end=${formatDateTime(end)}`,
    {
      headers: { Authorization: authToken },
    }
  ).then(handleErrors)
}

// Labels

export async function getLabels(authToken: string, title: string = ''): Promise<Label[]> {
  return fetch(`${API_URL}/labels/?title=${title}`, {
    headers: { Authorization: authToken },
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
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabel(label: Label, authToken: string): Promise<Label> {
  return fetch(`${API_URL}/labels/${label.id}`, {
    method: 'PUT',
    body: JSON.stringify(label),
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then(Label.fromJson)
}

export async function putLabels(labels: Label[], authToken: string): Promise<Label[]> {
  return fetch(`${API_URL}/labels/`, {
    method: 'PUT',
    body: JSON.stringify(labels),
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((labels) => labels.map((label) => Label.fromJson(label)))
}

// Label Rules

export async function getLabelRules(labelText: string, authToken: string): Promise<LabelRule[]> {
  return fetch(`${API_URL}/label_rules/?text=${labelText}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => resp.map((rule: any) => LabelRule.fromJson(rule)))
}

export async function putLabelRule(labelRule: LabelRule, authToken: string): Promise<LabelRule> {
  return fetch(`${API_URL}/label_rules/`, {
    method: 'PUT',
    body: JSON.stringify(labelRule),
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then(LabelRule.fromJson)
}

export async function syncCalendar(authToken: string) {
  return fetch(`${API_URL}/sync/`, {
    method: 'POST',
    headers: { Authorization: authToken },
  }).then(handleErrors)
}
