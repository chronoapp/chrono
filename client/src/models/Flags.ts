/**
 * User Flags.
 */
export default class Flags {
  static fromJson(flagsJson: any) {
    return new Flags(flagsJson.EXPAND_ALL_DAY_EVENTS)
  }

  constructor(readonly EXPAND_ALL_DAY_EVENTS: boolean) {}
}
