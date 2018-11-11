

/**
 * Calendar Event.
 */
export class Event {
    title: string
    labels: string[]
    startTime: Date
    endTime: Date

    constructor(title: string, labels: string[], startTime: Date, endTime: Date) {
        this.title = title;
        this.labels = labels;
        this.startTime = startTime;
        this.endTime = endTime;
    }
}
