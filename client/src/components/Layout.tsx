import React from 'react'
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil'
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
} from '@chakra-ui/react'
import { Modal, ModalOverlay, ModalContent, ModalCloseButton } from '@chakra-ui/react'

import { FiSettings, FiLogOut } from 'react-icons/fi'

import { roundNext15Min } from '@/util/localizer'
import { GlobalEvent } from '@/util/global'

import MiniCalendar from '@/calendar/MiniCalendar'
import LabelPanel from '@/components/LabelPanel'
import CalendarsPanel from '@/components/CalendarsPanel'
import Plugins from '@/components/Plugins'
import Settings from '@/components/Settings'
import useWebSocket from '@/util/useWebsockets'

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
      flexShrink={0}
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

function TopNavigationBar(props: { canCreateEvent: boolean; searchQuery: string }) {
  return (
    <Flex
      height="3.25rem"
      borderBottom="1px solid #dfdfdf"
      alignItems="center"
      className="navbar-menu"
    >
      {props.canCreateEvent && <Header search={props.searchQuery} />}

      <Flex justifyContent="flex-end" align="flex-end">
        <Flex alignItems="center" justifyContent="center">
          <SettingsMenu />
        </Flex>
      </Flex>
    </Flex>
  )
}

function SettingsMenu() {
  const navigate = useNavigate()
  const [settingsActive, setSettingsActive] = React.useState<boolean>(false)

  const logout = () => {
    setLocalStorageItem('auth_token', undefined)
    navigate('/login', { replace: true })
  }

  return (
    <Menu size={'sm'}>
      <MenuButton ml="2" mr="2" p="1" as={Button} bgColor="transparent" borderRadius={'md'}>
        <Avatar size="xs" />
      </MenuButton>

      <MenuList zIndex="2">
        <MenuDivider m="0" />
        <MenuItem icon={<FiSettings />} fontSize={'sm'} onClick={() => setSettingsActive(true)}>
          Settings
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem fontSize={'sm'} icon={<FiLogOut />} onClick={logout}>
          Sign Out
        </MenuItem>
      </MenuList>

      <Modal size="2xl" isOpen={settingsActive} onClose={() => setSettingsActive(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <Settings />
        </ModalContent>
      </Modal>
    </Menu>
  )
}

/**
 * Top Level Layout for the navigation and body.
 */
function Layout(props: Props) {
  const params = useParams()
  const searchQuery = (params.search as string) || ''
  const [user, setUser] = useRecoilState(userState)

  /**
   * Sends an event to refresh the calendar when a notification is received.
   */
  useWebSocket(user?.id || null, (msg) => {
    if (msg === 'REFRESH_CALENDAR') {
      document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))
    }
  })

  React.useEffect(() => {
    async function fetchUser() {
      const userInfo = await API.getUser()
      setUser(userInfo)
    }

    fetchUser()
  }, [])

  return (
    <Box className="App">
      <Flex height="100vh" width="100%" overflowY={'auto'}>
        {props.includeLeftPanel && (
          <Box className="left-section">
            {props.canCreateEvent && <NewEventButton />}
            <Flex height="100%" flexDirection="column" pb="2" overflowY={'auto'}>
              <MiniCalendar />

              <Flex
                className="left-section-scrollable"
                overflowY={'scroll'}
                flexDirection={'column'}
                height="100%"
              >
                <LabelPanel />
                <CalendarsPanel />
              </Flex>
            </Flex>
          </Box>
        )}

        <Flex direction="column" width="100%">
          <TopNavigationBar canCreateEvent={props.canCreateEvent} searchQuery={searchQuery} />

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
