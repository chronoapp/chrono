

export class Label {
    title: string
    key: string

    static fromJson(labelJson: any) {
        return new Label(labelJson.title, labelJson.key);
    }

    constructor(title: string, key: string) {
        this.title = title
        this.key = key
    }
}
