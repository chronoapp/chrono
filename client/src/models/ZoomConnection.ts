export default class ZoomConnection {
  static fromJson(json: any) {
    return new ZoomConnection(json.email)
  }

  constructor(readonly email: string) {}
}
