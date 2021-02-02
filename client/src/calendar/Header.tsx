import React from 'react'
import clsx from 'clsx'

import { FiChevronDown, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { EventActionContext, Display } from './EventActionContext'
import { LabelContext } from '../components/LabelsContext'
import { format } from '../util/localizer'
import { GlobalEvent } from '../util/global'
import * as dates from '../util/dates'
import useClickOutside from '../lib/hooks/useClickOutside'

import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'

/**
 * Calendar header for date selection.
 */
export default function Header() {
  const eventsContext = React.useContext(EventActionContext)
  const labelsContext = React.useContext(LabelContext)

  const [displayToggleActive, setDisplayToggleActive] = React.useState<boolean>(false)
  const displayToggleRef = React.useRef<HTMLDivElement>(null)

  const today = new Date()
  const display = eventsContext.display
  const title = getViewTitle(display)

  useClickOutside(displayToggleRef, () => {
    if (displayToggleActive) {
      setDisplayToggleActive(false)
    }
  })

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [eventsContext.eventState.editingEvent, labelsContext.labelState.editingLabel])

  function isEditing() {
    return !!eventsContext.eventState.editingEvent || labelsContext.labelState.editingLabel.active
  }

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      eventsContext.eventDispatch({ type: 'CANCEL_SELECT' })
      setDisplayToggleActive(false)
    }

    if (!isEditing()) {
      if (e.key === 'd') {
        selectDisplay('Day')
      }

      if (e.key === 'w') {
        selectDisplay('Week')
      }

      if (e.key === 'x') {
        selectDisplay('WorkWeek')
      }

      if (e.key === 'm') {
        selectDisplay('Month')
      }
    }
  }

  function titleForDisplay(display: Display) {
    switch (display) {
      case 'WorkWeek': {
        return 'Work week'
      }
      default: {
        return display
      }
    }
  }

  function getViewTitle(display: Display) {
    if (display == 'Day') {
      return format(eventsContext.selectedDate, 'LL')
    } else if (display == 'Week') {
      return Week.getTitle(eventsContext.selectedDate)
    } else if (display == 'WorkWeek') {
      return WorkWeek.getTitle(eventsContext.selectedDate)
    } else if (display == 'Month') {
      return Month.getTitle(eventsContext.selectedDate)
    }
  }

  function selectDisplay(display: Display) {
    if (display === 'Month') {
      // HACK: Prevents flicker when switching months
      eventsContext.eventDispatch({ type: 'INIT', payload: [] })
    }

    eventsContext.setDisplay(display)
    setDisplayToggleActive(false)
  }

  return (
    <div
      className={clsx(
        'has-width-100',
        'dropdown',
        'calendar-header',
        displayToggleActive && 'is-active'
      )}
    >
      <div className="is-flex is-align-items-center">
        <div
          className="button is-small is-light"
          onClick={() => {
            if (dates.eq(eventsContext.selectedDate, today, 'day')) {
              document.dispatchEvent(new Event(GlobalEvent.scrollToEvent))
            } else {
              eventsContext.setSelectedDate(today)
            }
          }}
        >
          Today
        </div>
        <button
          className="button is-text is-small is-size-6"
          onClick={() => {
            if (display == 'Day') {
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 1, 'day'))
            } else if (display == 'Week' || display == 'WorkWeek') {
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 7, 'day'))
            } else if (display == 'Month') {
              // HACK: Prevents flicker when switching months
              eventsContext.eventDispatch({ type: 'INIT', payload: [] })
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 1, 'month'))
            }
          }}
        >
          <span className="icon">
            <FiChevronLeft size={'1.25em'} />
          </span>
        </button>
        <button
          className="button is-text is-small is-size-6"
          onClick={() => {
            if (display == 'Day') {
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 1, 'day'))
            } else if (display == 'Week' || display == 'WorkWeek') {
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 7, 'day'))
            } else if (display == 'Month') {
              eventsContext.eventDispatch({ type: 'INIT', payload: [] })
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 1, 'month'))
            }
          }}
        >
          <span className="icon">
            <FiChevronRight size={'1.25em'} />
          </span>
        </button>
        <div className="has-text-grey-dark pl-2" style={{ display: 'flex', alignItems: 'center' }}>
          {title}
        </div>
      </div>

      <div className="calendar-dropdown is-flex is-align-items-center">
        <div className="dropdown-trigger">
          <button
            className="button is-light is-small"
            aria-haspopup="true"
            aria-controls="dropdown-menu"
            onClick={() => setDisplayToggleActive(!displayToggleActive)}
          >
            <span>{titleForDisplay(display)}</span>
            <span className="icon is-small">
              <FiChevronDown />
            </span>
          </button>
        </div>

        <div
          ref={displayToggleRef}
          className="dropdown-menu is-small"
          id="dropdown-menu"
          role="menu"
          style={{ left: 'auto', minWidth: '10rem', right: 0, top: '100%' }}
        >
          <div className="dropdown-content has-text-left">
            <a onClick={() => selectDisplay('Day')} className="dropdown-item">
              Day (d)
            </a>
            <a onClick={() => selectDisplay('Week')} className="dropdown-item">
              Week (w)
            </a>
            <a onClick={() => selectDisplay('WorkWeek')} className="dropdown-item">
              Work week (x)
            </a>
            <a onClick={() => selectDisplay('Month')} className="dropdown-item">
              Month (m)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
