import React from 'react'
import clsx from 'clsx'

interface IProps {
  isActive: boolean
  onCancel: () => void
  onSave: (
    name: string,
    description: string,
    timezone: string,
    backgroundColor: string,
    isGoogleCalendar: boolean
  ) => void
}

const DEFAULT_CALENDAR_BG_COLOR = '#2196f3'

/**
 * Modal to add / edit a calendar.
 */
export default function CalendarEditModal(props: IProps) {
  const [calendarName, setCalendarName] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [timezone, setTimezone] = React.useState<string>(null!)
  const [isGoogleCalendar, setIsGoogleCalendar] = React.useState<boolean>(false)
  const [backgroundColor, setBackgroundColor] = React.useState<string>(DEFAULT_CALENDAR_BG_COLOR)

  return (
    <div className={clsx(props.isActive && 'is-active', 'modal')}>
      <div className="modal-background"></div>
      <div className="modal-card" style={{ maxWidth: '30em' }}>
        <header className="modal-card-head">
          <p className="modal-card-title">New Calendar</p>
        </header>
        <section className="modal-card-body">
          <div className="field">
            <label className="label has-text-left">Title</label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder=""
                value={calendarName}
                onChange={(e) => {
                  setCalendarName(e.target.value)
                }}
              />
            </div>
          </div>
          <div className="field">
            <label className="label has-text-left">Description</label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder=""
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                }}
              />
            </div>
          </div>
        </section>
        <footer className="modal-card-foot" style={{ justifyContent: 'flex-end' }}>
          <button
            className="button is-primary"
            onClick={() =>
              props.onSave(calendarName, description, timezone, backgroundColor, isGoogleCalendar)
            }
          >
            Save
          </button>
          <button className="button" onClick={props.onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
