
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

export class CalendarEvent {
    id: number
    title: string
    description: string
    startTime: number
    endTime: number
    labels: EventLabel[]

    static fromJson(eventJson: {
        id: number, title: string, description: string,
        start_time: number, end_time: number, labels: string[]
    }): CalendarEvent {
        return new CalendarEvent(eventJson.id, eventJson.title,
            eventJson.description, eventJson.start_time, eventJson.end_time,
            eventJson.labels.map(labelJson => EventLabel.fromJson(labelJson)));
    }

    constructor(id: number, title: string, description: string, startTime: number,
        endTime: number, labels: EventLabel[]) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.endTime = endTime;
        this.labels = labels;
    }
}
