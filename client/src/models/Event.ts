
export class CalendarEvent {
    id: number
    title: string
    description: string
    startTime: number
    endTime: number
    labels: string[]

    static fromJson(eventJson: {
        id: number, title: string, description: string,
        start_time: number, end_time: number, labels: string[]
    }): CalendarEvent {
        return new CalendarEvent(eventJson.id, eventJson.title,
            eventJson.description, eventJson.start_time, eventJson.end_time, eventJson.labels);
    }

    constructor(id: number, title: string, description: string, startTime: number,
        endTime: number, labels: string[]) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.endTime = endTime;
        this.labels = labels;
    }
}
