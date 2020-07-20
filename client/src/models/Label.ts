export type TimePeriod = 'DAY' | 'WEEK' | 'MONTH';

export class Label {
    id: number
    parent_id?: number
    title: string
    key: string
    color_hex: string

    static fromJson(labelJson: any) {
        return new Label(labelJson.id, labelJson.parent_id,
            labelJson.title, labelJson.key, labelJson.color_hex);
    }

    constructor(id: number, parent_id: number, title: string, key: string, color_hex: string) {
        this.id = id
        this.parent_id = parent_id
        this.title = title
        this.key = key
        this.color_hex = color_hex
    }
}