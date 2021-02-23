import React from 'react'
import {
  Box,
  Flex,
  Avatar,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@chakra-ui/react'
import { FiSettings, FiLogOut } from 'react-icons/fi'

import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'

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
  const eventsContext = React.useContext(EventActionContext)
  // TODO: Scroll to the event if it's off-screen.

  return (
    <Button
      borderRadius="sm"
      colorScheme="primary"
      maxHeight="2.2em"
      maxWidth="8em"
      mt="2"
      size="sm"
      onClick={() => {
        eventsContext.eventDispatch({
          type: 'INIT_NEW_EVENT_AT_DATE',
          payload: { date: roundNext15Min(new Date()), allDay: false },
        })
      }}
    >
      Create Event
    </Button>
  )
}

/**
 * Top Level Layout for the navigation and body.
 */
// export default class Layout extends React.Component<Props, {}> {
function Layout(props: Props) {
  const alertsContext = React.useContext(AlertsContext)

  async function refreshCalendar() {
    alertsContext.addMessage('Updating calendar..')
    await syncCalendar(getAuthToken())
    alertsContext.addMessage('Calendar updated.')
    document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))
  }

  function Settings() {
    const router = useRouter()

    return (
      <Menu>
        <MenuButton ml="2" mr="2">
          <Avatar size="sm" />
        </MenuButton>
        <MenuList zIndex="2">
          <MenuItem onClick={refreshCalendar}>Refresh Events</MenuItem>
          <MenuDivider m="0" />
          <MenuItem icon={<FiSettings />} onClick={() => router.push('/settings')}>
            Settings
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem icon={<FiLogOut />} onClick={signOut}>
            Sign Out
          </MenuItem>
        </MenuList>
      </Menu>
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
