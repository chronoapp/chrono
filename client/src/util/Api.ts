import Router from 'next/router'
import Cookies from 'universal-cookie'
import { CalendarEvent } from '../models/Event'
import { Label, TimePeriod } from '../models/Label'
import { LabelRule } from '../models/LabelRule'
import Calendar from '../models/Calendar'

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

export async function getEvents(authToken: string, title: string = ''): Promise<CalendarEvent[]> {
  return fetch(`${API_URL}/events/?title=${title}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => CalendarEvent.fromJson(eventJson))
    })
}

export async function updateEvent(authToken: string, event: CalendarEvent): Promise<CalendarEvent> {
  return fetch(`${API_URL}/events/${event.id}`, {
    method: 'PUT',
    headers: { Authorization: authToken },
    body: JSON.stringify(event),
  })
    .then(handleErrors)
    .then((resp) => CalendarEvent.fromJson(resp))
}

export async function searchEvents(authToken: string, query: string): Promise<CalendarEvent[]> {
  return fetch(`${API_URL}/events/?query=${query}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => {
      return resp.map((eventJson: any) => CalendarEvent.fromJson(eventJson))
    })
}

// ================== Trends and Stats ==================

export async function getTrends(authToken: string, timePeriod: TimePeriod) {
  return fetch(`${API_URL}/trends/work?time_period=${timePeriod}`, {
    headers: { Authorization: authToken },
  }).then(handleErrors)
}

// Labels

export async function getLabels(authToken: string, title: string = ''): Promise<Label[]> {
  return fetch(`${API_URL}/labels/?title=${title}`, {
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then((resp) => resp.map((label: any) => Label.fromJson(label)))
}

export async function putLabel(label: Label, authToken: string): Promise<Label> {
  return fetch(`${API_URL}/labels/${label.key}`, {
    method: 'PUT',
    body: JSON.stringify(label),
    headers: { Authorization: authToken },
  })
    .then(handleErrors)
    .then(Label.fromJson)
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
