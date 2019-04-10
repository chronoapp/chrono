
import { Label } from './Label';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class CalendarEvent {
    id: number
    title: string
    description: string
    startTime: Date
    endTime: Date
    labels: Label[]
    dayDisplay: string

    static fromJson(eventJson: {
        id: number, title: string, description: string,
        start_time: string, end_time: string, labels: string[]
    }): CalendarEvent {
        return new CalendarEvent(eventJson.id, eventJson.title,
            eventJson.description, new Date(eventJson.start_time), new Date(eventJson.end_time),
            eventJson.labels.map(labelJson => Label.fromJson(labelJson)));
    }

    constructor(id: number, title: string, description: string, startTime: Date,
        endTime: Date, labels: Label[]) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.endTime = endTime;
        this.labels = labels;
        this.dayDisplay = `${MONTHS[this.startTime.getMonth()]} ${this.startTime.getDate()}`
    }
}
