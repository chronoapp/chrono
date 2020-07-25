type AccessRole = 'reader' | 'writer' | 'owner' | 'freeBusyReader'

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
      json.primary,
      json.access_role
    )
  }

  constructor(
    id: string,
    summary: string,
    description: string,
    backgroundColor: string,
    foregroundColor: string,
    selected: boolean,
    primary: boolean,
    readonly accessRole: AccessRole
  ) {
    this.id = id
    this.summary = summary
    this.description = description
    this.backgroundColor = backgroundColor
    this.foregroundColor = foregroundColor
    this.selected = selected
    this.primary = primary
    this.accessRole = accessRole
  }

  public isWritable(): boolean {
    return this.accessRole == 'writer' || this.accessRole == 'owner'
  }
}
