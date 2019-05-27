
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

    public toDict() {
        return {
            'id': this.id,
            'title': this.title,
            'description': this.description,
            'start_time': this.startTime,
            'end_time': this.endTime,
            'labels': this.labels
        }
    }

    public getDuration(): string {
        const milliseconds = this.endTime.getTime() - this.startTime.getTime();
        const minutes = milliseconds / 1000 / 60;

        if (minutes < 60) {
            return `${minutes}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const min = minutes % 60;
            return min > 0 ? `${hours}h ${min}m` : `${hours}h`;
        }
    }
}
