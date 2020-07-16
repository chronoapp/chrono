import React, { useContext, useState } from 'react'

import Icon from '@mdi/react'
import { mdiTextSubject, mdiClockOutline, mdiCalendar, mdiDeleteOutline } from '@mdi/js'

import { createEvent, getAuthToken } from '../util/Api'
import Event from '../models/Event'
import { EventActionContext } from './EventActionContext'
import { CalendarsContext } from '../components/CalendarsContext'
import { format } from '../util/localizer'

function EventPopover(props: { event: Event }) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)

  const [title, setTitle] = useState(props.event.title)
  const [description, setDescription] = useState(props.event.description)
  const [start, setStart] = useState(props.event.start)
  const [end, setEnd] = useState(props.event.end)
  const [calendarId, setCalendarId] = useState(getPrimaryId())

  function onCreateEvent() {
    const event = props.event
    event.title = title
    event.description = description
    event.start = start
    event.end = end
    event.calendar_id = calendarId

    eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })

    // const token = getAuthToken()
    // createEvent(token, event).then((r) => {
    //   console.log('RESULT')
    //   console.log(r)
    // })
  }

  function getPrimaryId() {
    const primaryCalendar = calendarContext.calendars.filter((c) => c.primary)
    if (primaryCalendar.length === 1) {
      return primaryCalendar[0].id
    }
  }

  const isExistingEvent = props.event.id !== -1

  return (
    <div className="cal-event-modal" style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
        <input
          type="text"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%' }}
        ></input>
      </div>

      <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
        <Icon className="mr-2" path={mdiClockOutline} size={1} />
        <input
          type="date"
          value={format(start, 'YYYY-MM-DD')}
          onChange={(e) => console.log(e.target.value)}
        />
        <span>{format(start, 'hh:mm')}</span> to <span>{format(end, 'HH:mm')}</span>
      </div>

      <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
        <Icon className="mr-2" path={mdiTextSubject} size={1} />
        <input
          type="textarea"
          name="description"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
        <Icon className="mr-2" path={mdiCalendar} size={1} />
        <div className="select">
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {calendarContext.calendars.map((calendar) => {
              return (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                </option>
              )
            })}
          </select>
        </div>
      </div>

      <div className="mt-4" style={{ display: 'flex' }}>
        <button className="button is-primary" onClick={onCreateEvent}>
          Save
        </button>

        {isExistingEvent ? (
          <button
            className="button is-light ml-2"
            onClick={() => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
              eventActions.eventDispatch({
                type: 'DELETE_EVENT',
                payload: { eventId: props.event.id },
              })
            }}
          >
            <Icon className="mr-1" path={mdiDeleteOutline} size={1} />
            Delete{' '}
          </button>
        ) : (
          <button
            className="button is-light ml-2"
            onClick={() => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  )
}

export default EventPopover
