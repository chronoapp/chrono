import React from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { useParams, useNavigate } from 'react-router-dom'

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
} from '@chakra-ui/react'
import { FiSettings, FiLogOut } from 'react-icons/fi'

import { roundNext15Min } from '@/util/localizer'
import { GlobalEvent } from '@/util/global'

import MiniCalendar from '@/calendar/MiniCalendar'
import LabelPanel from './LabelPanel'
import CalendarsPanel from './CalendarsPanel'
import Plugins from './Plugins'
import { ToastTag } from '@/components/Toast'

import Header from '@/calendar/Header'
import * as API from '@/util/Api'
import { userState } from '@/state/UserState'
import { primaryCalendarSelector } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { setLocalStorageItem } from '@/lib/local-storage'

interface Props {
  title: string
  children: React.ReactNode
  canCreateEvent: boolean
  includeLeftPanel: boolean
}

function NewEventButton() {
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const eventActions = useEventActions()

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
        eventActions.initNewEventAtDate(primaryCalendar!, false, roundNext15Min(new Date()))
      }}
    >
      New Event
    </Button>
  )
}

function TopNavigationBar(props: {
  refreshCalendar: () => void
  canCreateEvent: boolean
  searchQuery: string
}) {
  return (
    <Flex
      height="3.25rem"
      borderBottom="1px solid #dfdfdf"
      alignItems="stretch"
      className="navbar-menu"
    >
      {props.canCreateEvent && <Header search={props.searchQuery} />}

      <Flex justifyContent="flex-end" align="flex-end">
        <Flex alignItems="center" justifyContent="center" padding="2">
          <Settings refreshCalendar={props.refreshCalendar} />
        </Flex>
      </Flex>
    </Flex>
  )
}

function Settings(props: { refreshCalendar: () => void }) {
  const navigate = useNavigate()

  const logout = () => {
    setLocalStorageItem('auth_token', undefined)
    navigate('/login', { replace: true })
  }

  return (
    <Menu>
      <MenuButton ml="2" mr="2">
        <Avatar size="sm" />
      </MenuButton>
      <MenuList zIndex="2">
        <MenuItem fontSize={'sm'} onClick={props.refreshCalendar}>
          Refresh Events
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem
          icon={<FiSettings />}
          fontSize={'sm'}
          onClick={() => {
            navigate('/settings')
          }}
        >
          Settings
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem fontSize={'sm'} icon={<FiLogOut />} onClick={logout}>
          Sign Out
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

/**
 * Top Level Layout for the navigation and body.
 */
function Layout(props: Props) {
  const toast = useToast()

  const params = useParams()
  const searchQuery = (params.search as string) || ''
  const setUser = useSetRecoilState(userState)

  React.useEffect(() => {
    async function fetchUser() {
      const userInfo = await API.getUser()
      setUser(userInfo)
    }

    fetchUser()
  }, [])

  async function refreshCalendar() {
    const toastId = toast({
      render: (props) => (
        <ToastTag
          title={'Updating calendar..'}
          showSpinner={false}
          Icon={props.icon}
          onClose={props.onClose}
        />
      ),
    })

    await API.syncCalendar()

    document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))

    toastId && toast.close(toastId)
    toast({
      render: (props) => (
        <ToastTag
          title={'Calendar updated.'}
          showSpinner={false}
          Icon={props.icon}
          onClose={props.onClose}
        />
      ),
    })
  }

  return (
    <Box className="App">
      <Flex height="100vh" width="100%" overflowY={'auto'}>
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

        <Flex direction="column" width="100%">
          <TopNavigationBar
            refreshCalendar={refreshCalendar}
            canCreateEvent={props.canCreateEvent}
            searchQuery={searchQuery}
          />

          <Box height="100%" overflowY="auto">
            {props.children}
          </Box>
        </Flex>

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
