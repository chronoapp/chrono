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
  useToast,
  Image,
} from '@chakra-ui/react'
import { FiSettings, FiLogOut } from 'react-icons/fi'

import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'

import { getAuthToken, signOut, syncCalendar } from '@/util/Api'
import { roundNext15Min } from '@/util/localizer'
import { GlobalEvent } from '@/util/global'

import MiniCalendar from '@/calendar/MiniCalendar'
import LabelPanel from './LabelPanel'
import CalendarsPanel from './CalendarsPanel'
import Plugins from './Plugins'
import Toast from '@/components/Toast'
import { EventActionContext } from '@/calendar/EventActionContext'

import Header from '@/calendar/Header'

interface Props {
  title: string
  children: React.ReactNode
  canCreateEvent: boolean
  includeLeftPanel: boolean
}

function NewEventButton() {
  const eventsContext = React.useContext(EventActionContext)
  return (
    <Button
      borderRadius="sm"
      colorScheme="primary"
      maxHeight="2.2em"
      maxWidth="8em"
      mt="2"
      mb="2"
      size="sm"
      onClick={() => {
        // TODO: Create the event on the current view if current day is not in view.
        document.dispatchEvent(new Event(GlobalEvent.scrollToEvent))
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

function TopNavigationBar(props: {
  refreshCalendar: () => void
  canCreateEvent: boolean
  searchQuery: string
}) {
  const router = useRouter()

  return (
    <Flex height="3.25rem" borderBottom="1px solid #dfdfdf">
      <Box w="100%" display="flex">
        <Flex alignItems="stretch" className="navbar-menu">
          <Link href="/">
            <Flex href="#" alignItems="center" justifyContent="center" padding="2" ml="2">
              <Image
                fallbackSrc={'./chrono.svg'}
                src={'./chrono.svg'}
                alt="Chrono logo"
                boxSize={'2em'}
                _hover={{
                  cursor: 'pointer',
                }}
              />
              <Button
                ml="2"
                mb="1"
                padding="2"
                pl="0"
                variant="unstyled"
                borderRadius="0"
                height="100%"
                color={router.pathname === '/' ? 'primary.800' : 'gray.500'}
                fontWeight={'medium'}
              >
                Calendar
              </Button>
            </Flex>
          </Link>
        </Flex>

        {props.canCreateEvent && <Header search={props.searchQuery} />}
      </Box>

      <Flex justifyContent="flex-end">
        <Flex alignItems="center" justifyContent="center" padding="2">
          <Settings refreshCalendar={props.refreshCalendar} />
        </Flex>
      </Flex>
    </Flex>
  )
}

function Settings(props: { refreshCalendar: () => void }) {
  const router = useRouter()

  return (
    <Menu>
      <MenuButton ml="2" mr="2">
        <Avatar size="sm" />
      </MenuButton>
      <MenuList zIndex="2">
        <MenuItem onClick={props.refreshCalendar}>Refresh Events</MenuItem>
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

/**
 * Top Level Layout for the navigation and body.
 */
// export default class Layout extends React.Component<Props, {}> {
function Layout(props: Props) {
  const toast = useToast({ duration: 2000, position: 'top' })
  const router = useRouter()
  const searchQuery = (router.query.search as string) || ''

  async function refreshCalendar() {
    const toastId = toast({
      render: (props) => <Toast title={'Updating calendar..'} showSpinner={false} {...props} />,
    })

    await syncCalendar(getAuthToken())

    document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))

    toastId && toast.close(toastId)
    toast({
      render: (props) => <Toast title={'Calendar updated.'} showSpinner={false} {...props} />,
    })
  }

  return (
    <Box className="App">
      <Head>
        <title>{props.title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <link rel="icon" type="image/svg+xml" href="/chrono.svg" />
      </Head>

      <TopNavigationBar
        refreshCalendar={refreshCalendar}
        canCreateEvent={props.canCreateEvent}
        searchQuery={searchQuery}
      />

      <Flex height="calc(100vh - 3.25rem)" width="100%" overflowY="auto">
        {props.includeLeftPanel && (
          <Box className="left-section">
            {props.canCreateEvent && <NewEventButton />}
            <Flex overflowY="scroll" pr="1" height="100%" flexDirection="column" pb="2">
              <MiniCalendar />
              <LabelPanel />
              <CalendarsPanel />
            </Flex>
          </Box>
        )}
        {props.children}
        <Plugins />
      </Flex>

      <footer></footer>
    </Box>
  )
}

Layout.defaultProps = {
  title: 'Chrono',
  canCreateEvent: false,
  includeLeftPanel: true,
}

export default Layout
