import { CalendarEvent } from '../models/Event';

const API_URL = 'http://localhost:5555'
const userId = '1'; // TODO

function handleErrors(response: any) {
    if (!response.ok) {
        throw response;
    }
    return response.json();
}

export function getEvents(): Promise<CalendarEvent[]> {
    return fetch(`${API_URL}/events?user_id=${userId}`)
        .then(handleErrors)
        .then(resp => {
            return resp.events.map((eventJson: any) =>
                CalendarEvent.fromJson(eventJson))
        });
}


export function getLabels(): Promise<string[]> {
    return fetch(`${API_URL}/labels?user_id=${userId}`)
        .then(handleErrors)
        .then(resp => resp.labels);
}
