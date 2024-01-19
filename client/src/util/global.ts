/**
 * Global event messaging through Document.createEvent().
 * Use sparingly.
 */

export enum GlobalEvent {
  refreshCalendar = 'refreshCalendar',
  refreshCalendarList = 'refreshCalendarList',
  scrollToEvent = 'scrollToEvent',
}
