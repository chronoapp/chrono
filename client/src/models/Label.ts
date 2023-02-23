export type TimePeriod = 'DAY' | 'WEEK' | 'MONTH'

export class Label {
  static fromJson(labelJson: any) {
    return new Label(
      labelJson.id,
      labelJson.title,
      labelJson.key,
      labelJson.color_hex,
      labelJson.position,
      labelJson.parent_id
    )
  }

  constructor(
    readonly id: string,
    readonly title: string,
    readonly key: string,
    readonly color_hex: string,
    readonly position: number,
    readonly parent_id?: string
  ) {}
}
