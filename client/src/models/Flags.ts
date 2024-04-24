/**
 * User Flags.
 */
export default class Flags {
  static fromJson(flagsJson: any) {
    return new Flags(
      flagsJson.EXPAND_ALL_DAY_EVENTS,
      flagsJson.ONBOARDING_COMPLETE,
      flagsJson.INITIAL_SYNC_COMPLETE,
      flagsJson.DISABLE_TAGS,
      flagsJson.SHOULD_PROMPT_TIMEZONE_CHANGE,
      flagsJson.LAST_PROMPTED_TIMEZONE_TO_CHANGE
    )
  }

  constructor(
    readonly EXPAND_ALL_DAY_EVENTS: boolean,
    readonly ONBOARDING_COMPLETE: boolean,
    readonly INITIAL_SYNC_COMPLETE: boolean,
    readonly DISABLE_TAGS: boolean,
    readonly SHOULD_PROMPT_TIMEZONE_CHANGE: boolean,
    readonly LAST_PROMPTED_TIMEZONE_TO_CHANGE: string
  ) {}
}
