import React, { useState, useContext } from 'react'
import clsx from 'clsx'
import { Box, Flex, Button } from '@chakra-ui/react'

import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { FiMoreHorizontal } from 'react-icons/fi'

import { getAuthToken, signOut, syncCalendar } from '../util/Api'
import { roundNext15Min } from '../util/localizer'
import { GlobalEvent } from '../util/global'

import MiniCalendar from '../calendar/MiniCalendar'
import LabelPanel from './LabelPanel'
import CalendarsPanel from './CalendarsPanel'
import Plugins from './Plugins'
import { AlertsContext } from '../components/AlertsContext'
import { EventActionContext } from '../calendar/EventActionContext'

import Header from '../calendar/Header'
import '../style/index.scss'

interface Props {
  title: string
  children: any
  canCreateEvent: boolean
  includeLeftPanel: boolean
}

function NewEventButton() {
  const eventsContext = useContext(EventActionContext)

  // TODO: Scroll to the event if it's off-screen.
  return (
    <button
      className="button is-small is-primary mt-3"
      style={{ maxWidth: '8em', maxHeight: '2.2em' }}
      onClick={() => {
        eventsContext.eventDispatch({
          type: 'INIT_NEW_EVENT_AT_DATE',
          payload: { date: roundNext15Min(new Date()), allDay: false },
        })
      }}
    >
      Create Event
    </button>
  )
}

/**
 * Top Level Layout for the navigation and body.
 */
// export default class Layout extends React.Component<Props, {}> {
function Layout(props: Props) {
  const [settingsActive, setSettingsActive] = useState(false)
  const alertsContext = useContext(AlertsContext)

  async function refreshCalendar() {
    setSettingsActive(false)
    alertsContext.addMessage('Updating calendar..')
    await syncCalendar(getAuthToken())
    alertsContext.addMessage('Calendar updated.')
    document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))
  }

  function Settings() {
    const router = useRouter()

    return (
      <div className={clsx('dropdown', settingsActive && 'is-active')}>
        <div className="dropdown-trigger" onClick={() => setSettingsActive(!settingsActive)}>
          <button className="button is-text">
            <FiMoreHorizontal size={'1.25em'} />
          </button>
        </div>
        <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
          <div className="dropdown-content has-text-left">
            <a className="dropdown-item" onClick={() => router.push('/settings')}>
              Settings
            </a>
            <hr style={{ margin: 0 }} />
            <a className="dropdown-item" onClick={refreshCalendar}>
              Refresh Events
            </a>
            <hr style={{ margin: 0 }} />
            <a className="dropdown-item" onClick={signOut}>
              Sign Out
            </a>
          </div>
        </div>
      </div>
    )
  }

  function renderNavItems() {
    const router = useRouter()

    return (
      <Flex height="3.25rem" borderBottom="1px solid #dfdfdf">
        <Box w="100%" display="flex">
          <Flex alignItems="stretch" className="navbar-menu">
            <Flex href="#" alignItems="center" justifyContent="center" padding="2">
              <img
                src={'./timecouncil-symbol.png'}
                style={{ maxHeight: '2.5rem', width: '2.5rem' }}
              />
            </Flex>

            <Flex>
              <Link href="/">
                <Button
                  variant="unstyled"
                  borderRadius="0"
                  ml="2"
                  padding="2"
                  pl="0"
                  height="100%"
                  fontWeight={router.pathname === '/' ? 'medium' : 'normal'}
                >
                  Calendar
                </Button>
              </Link>
              <Link href="/events">
                <Button
                  variant="unstyled"
                  borderRadius="0"
                  ml="2"
                  padding="2"
                  height="100%"
                  fontWeight={router.pathname === '/events' ? 'medium' : 'normal'}
                >
                  Events
                </Button>
              </Link>
            </Flex>
          </Flex>

          {props.canCreateEvent && <Header />}
        </Box>

        <Flex justifyContent="flex-end">
          <Flex alignItems="center" justifyContent="center" padding="2">
            <Settings />
          </Flex>
        </Flex>
      </Flex>
    )
  }

  return (
    <div className="App">
      <Head>
        <title>{props.title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <link rel="shortcut icon" href="/favicon-128.ico" type="image/x-icon" />
        <link rel="icon" href="/favicon-128.ico" type="image/x-icon" />
      </Head>

      {renderNavItems()}

      <div className="app-content">
        {props.includeLeftPanel && (
          <div className="left-section">
            {props.canCreateEvent && <NewEventButton />}
            <div className="left-section-scrollable" style={{ overflowY: 'scroll' }}>
              <MiniCalendar />
              <LabelPanel />
              <CalendarsPanel />
            </div>
          </div>
        )}
        {props.children}
        <Plugins />
      </div>

      <footer></footer>
    </div>
  )
}

Layout.defaultProps = {
  title: 'Timecouncil',
  canCreateEvent: false,
  includeLeftPanel: true,
}

export default Layout
