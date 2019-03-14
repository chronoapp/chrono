import { CalendarEvent, EventLabel } from '../models/Event';
import 'isomorphic-unfetch';

const API_URL = 'http://localhost:5555'
const userId = '1'; // TODO

function handleErrors(response: any) {
    if (!response.ok) {
        throw response;
    }
    return response.json();
}

export async function getStats() {
    return fetch(`${API_URL}/stats?user_id=${userId}`)
        .then(handleErrors);
}

export async function getEvents(): Promise<CalendarEvent[]> {
    return fetch(`${API_URL}/events?user_id=${userId}`)
        .then(handleErrors)
        .then((resp) => {
            return resp.events.map((eventJson: any) =>
            CalendarEvent.fromJson(eventJson))
        });
}

export async function getLabels(): Promise<string[]> {
    return fetch(`${API_URL}/labels?user_id=${userId}`)
        .then(handleErrors)
        .then(resp => resp.labels);
}

export async function addLabel(eventId: number, label: EventLabel): Promise<EventLabel[]> {
    return fetch(`${API_URL}/events/${eventId}/add_label?user_id=${userId}`, {
        method: 'POST',
        body: JSON.stringify({
            'key': label.key
        })
    })
        .then(handleErrors)
        .then(resp => resp.labels.map(
            (labelJson: any) => EventLabel.fromJson(labelJson)));
}
