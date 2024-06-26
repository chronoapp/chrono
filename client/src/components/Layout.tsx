import React from 'react'
import { useRecoilValue, useRecoilState } from 'recoil'
import { useNavigate, useLocation } from 'react-router-dom'

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

import { ZonedDateTime as DateTime } from '@js-joda/core'
import { roundNext15Min } from '@/util/localizer-joda'

import { GlobalEvent } from '@/util/global'
import { generateGuid } from '@/lib/uuid'

import MiniCalendar from '@/calendar/MiniCalendar'
import LabelPanel from '@/components/LabelPanel'
import CalendarAccountList from '@/components/CalendarAccountList'
import Plugins from '@/components/Plugins'
import Settings from '@/components/settings/Settings'
import useNotifications from '@/util/useNotifications'
import LoadingScreen from '@/components/LoadingScreen'
import Onboarding from '@/components/Onboarding'

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

const LEFT_PANEL_WIDTH = '240px'

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
        eventActions.initNewEventAtDate(primaryCalendar!, false, roundNext15Min(DateTime.now()))
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
      minWidth={LEFT_PANEL_WIDTH}
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
  const user = useRecoilValue(userState)

  const logout = () => {
    setLocalStorageItem('auth_token', undefined)
    navigate('/login', { replace: true })
  }

  return (
    <Menu size={'sm'}>
      <MenuButton ml="2" mr="2" p="1" as={Button} bgColor="transparent" borderRadius={'md'}>
        <Avatar size="xs" src={user?.picture_url} />
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
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const searchQuery = queryParams.get('search') || '' // Retrieves 'abc' from '?search=abc'

  const [user, setUser] = useRecoilState(userState)
  const [refreshUserId, setRefreshUserId] = React.useState(generateGuid())

  /**
   * Sends an event to refresh the calendar when a notification is received.
   * TODO: More granular refreshes based on the notification.
   */
  useNotifications(user?.id || null, (msg) => {
    if (msg === 'REFRESH_CALENDAR') {
      document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))
    } else if (msg === 'REFRESH_CALENDAR_LIST') {
      document.dispatchEvent(new Event(GlobalEvent.refreshCalendarList))
    } else if (msg === 'REFRESH_USER') {
      setRefreshUserId(generateGuid())
    }
  })

  React.useEffect(() => {
    async function fetchUser() {
      const userInfo = await API.getUser()
      setUser(userInfo)
    }

    fetchUser()
  }, [refreshUserId])

  if (!user) {
    return <LoadingScreen />
  }

  if (!user.flags.ONBOARDING_COMPLETE) {
    return (
      <Onboarding
        user={user}
        onComplete={() => {
          return API.updateUserFlags('ONBOARDING_COMPLETE', true).then((flags) => {
            setUser({ ...user, flags: flags })
          })
        }}
      />
    )
  }

  if (!user.flags.INITIAL_SYNC_COMPLETE) {
    return <LoadingScreen loadingText="Setting up calendar.." />
  }

  return (
    <Box className="App">
      <Flex height="100vh" width="100%" overflowY={'auto'} bgColor={'#f3f3f3'}>
        {props.includeLeftPanel && (
          <Flex pl="2" pt="3" direction={'column'} minWidth={LEFT_PANEL_WIDTH}>
            {props.canCreateEvent && <NewEventButton />}
            <Flex height="100%" flexDirection="column" pb="2" overflowY={'auto'}>
              <MiniCalendar />

              <Flex overflowY={'scroll'} flexDirection={'column'} height="100%" pr="2">
                {!user.flags.DISABLE_TAGS && <LabelPanel />}
                <CalendarAccountList />
              </Flex>
            </Flex>
          </Flex>
        )}

        <Flex
          direction="row"
          width="100%"
          m="2"
          ml="1"
          bgColor="white"
          borderRadius={'sm'}
          border="1px solid #e6e6e6"
        >
          <Flex direction="column" width="100%" overflowY="hidden">
            <TopNavigationBar canCreateEvent={props.canCreateEvent} searchQuery={searchQuery} />
            <Box height="100%" overflowY="auto">
              {props.children}
            </Box>
          </Flex>
          <Plugins />
        </Flex>
      </Flex>
    </Box>
  )
}

Layout.defaultProps = {
  title: 'Chrono',
  canCreateEvent: false,
  includeLeftPanel: true,
}

export default Layout
