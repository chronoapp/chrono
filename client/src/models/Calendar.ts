export default class Calendar {
  public id: string
  public summary: string
  public description: string
  public backgroundColor: string
  public foregroundColor: string
  public selected: boolean
  public primary: boolean

  static fromJson(json): Calendar {
    return new Calendar(
      json.id,
      json.summary,
      json.description,
      json.background_color,
      json.foreground_color,
      json.selected,
      json.primary
    )
  }

  constructor(
    id: string,
    summary: string,
    description: string,
    backgroundColor: string,
    foregroundColor: string,
    selected: boolean,
    primary: boolean
  ) {
    this.id = id
    this.summary = summary
    this.description = description
    this.backgroundColor = backgroundColor
    this.foregroundColor = foregroundColor
    this.selected = selected
    this.primary = primary
  }
}
