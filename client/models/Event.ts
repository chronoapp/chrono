
export class EventLabel {
    title: string
    key: string

    static fromJson(labelJson: any) {
        return new EventLabel(labelJson.title, labelJson.key);
    }

    constructor(title: string, key: string) {
        this.title = title;
        this.key = key;
    }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class CalendarEvent {
    id: number
    title: string
    description: string
    startTime: Date
    endTime: Date
    labels: EventLabel[]
    dayDisplay: string

    static fromJson(eventJson: {
        id: number, title: string, description: string,
        start_time: string, end_time: string, labels: string[]
    }): CalendarEvent {
        return new CalendarEvent(eventJson.id, eventJson.title,
            eventJson.description, new Date(eventJson.start_time), new Date(eventJson.end_time),
            eventJson.labels.map(labelJson => EventLabel.fromJson(labelJson)));
    }

    constructor(id: number, title: string, description: string, startTime: Date,
        endTime: Date, labels: EventLabel[]) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.endTime = endTime;
        this.labels = labels;
        this.dayDisplay = `${MONTHS[this.startTime.getMonth()]} ${this.startTime.getDate()}`
    }
}
