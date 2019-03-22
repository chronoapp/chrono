import { CalendarEvent, EventLabel } from '../models/Event';
import 'isomorphic-unfetch';
import Cookies from 'universal-cookie';

const API_URL = 'http://localhost:5555'

function handleErrors(response: any) {
    if (!response.ok) {
        throw response;
    }
    return response.json();
}

// ================== Authentication ==================

export function getAuthToken(req?) {
    let cookies;
    if (req != null) {
      cookies = new Cookies(req.headers.cookie);
    } else {
      cookies = new Cookies()
    }

    return cookies.get('auth_token') || "";
}

export function getOauthUrl() {
    return `${API_URL}/oauth/google/auth`
}

export function signOut() {
    // TODO: Update state after this.
    const cookies = new Cookies();
    cookies.remove('auth_token')
}

export async function authenticate(
    code: string,
    state: string) {

    return fetch(`${API_URL}/oauth/google/token`, {
        method: 'POST',
        body: JSON.stringify({
            code, state
        })
    }).then(handleErrors);
}

// ================== Trends and Stats ==================
// TODO: Log users out if response is 403.

export async function getTrends(authToken: string) {
    return fetch(`${API_URL}/trends`, {
        headers: { 'Authorization': authToken }
    })
    .then(handleErrors);
}

export async function getEvents(authToken: string): Promise<CalendarEvent[]> {
    return fetch(`${API_URL}/events/`, {
        headers: { 'Authorization': authToken }
    })
    .then(handleErrors)
    .then((resp) => {
        return resp.events.map((eventJson: any) =>
        CalendarEvent.fromJson(eventJson))
    });
}

export async function getLabels(authToken: string): Promise<string[]> {
    return fetch(`${API_URL}/labels`, {
        headers: { 'Authorization': authToken }
    })
    .then(handleErrors)
    .then(resp => resp.labels);
}

export async function addLabel(
    authToken: string,
    eventId: number,
    label: EventLabel): Promise<EventLabel[]> {

    return fetch(`${API_URL}/events/${eventId}/add_label`, {
        method: 'POST',
        headers: { 'Authorization': authToken },
        body: JSON.stringify({
            'key': label.key
        })
    })
    .then(handleErrors)
    .then(resp => resp.labels.map(
        (labelJson: any) => EventLabel.fromJson(labelJson)));
}
