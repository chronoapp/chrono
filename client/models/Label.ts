

export class Label {
    title: string
    key: string
    color_hex: string

    static fromJson(labelJson: any) {
        return new Label(labelJson.title, labelJson.key, labelJson.color_hex);
    }

    constructor(title: string, key: string, color_hex: string) {
        this.title = title
        this.key = key
        this.color_hex = color_hex
    }
}
