import { IconButton, Flex } from '@chakra-ui/react'
import User from '@/models/User'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'
import { useRecoilState } from 'recoil'

import * as API from '@/util/Api'

function ToogleAdditionalTimezone({ addGutter }) {
  return (
    <IconButton
      size={'xs'}
      variant="ghost"
      aria-label="adding additional timezones"
      icon={<FiPlus />}
      onClick={() => addGutter()}
      width="4"
    />
  )
}
function ToggleExpandWeeklyRows(props: { expanded: boolean }) {
  const { updateExpandAllDayEvents } = useUserFlags()

  if (props.expanded) {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="collapse events"
        icon={<FiChevronUp />}
        onClick={() => updateExpandAllDayEvents(false)}
        width="4"
        mt="2"
      />
    )
  } else {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="expand events"
        icon={<FiChevronDown />}
        onClick={() => updateExpandAllDayEvents(true)}
        width="4"
        mt="2"
      />
    )
  }
}

const GutterHeader = ({ addGutter, width, headerHeight }) => {
  const { expandAllDayEvents, updateExpandAllDayEvents } = useUserFlags()

  return (
    <Flex
      className="rbc-label cal-time-header-gutter"
      width={width}
      height={headerHeight}
      direction={'row'}
      justifyContent={'flex-end'}
      alignItems="flex-end"
      position="sticky"
      left="0"
      background-color="white"
      z-index="10"
      margin-right="-1px"
    >
      <ToogleAdditionalTimezone addGutter={addGutter} />
      <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
    </Flex>
  )
}
function useUserFlags() {
  const [user, setUser] = useRecoilState(userState)
  const expandAllDayEvents = user?.flags.EXPAND_ALL_DAY_EVENTS || false

  function updateExpandAllDayEvents(expand: boolean) {
    const updatedFlags = { ...user?.flags, EXPAND_ALL_DAY_EVENTS: expand }

    setUser((state) =>
      state
        ? ({
            ...state,
            flags: updatedFlags,
          } as User)
        : state
    )

    user && API.updateUserFlags(updatedFlags)
  }

  return { expandAllDayEvents, updateExpandAllDayEvents }
}
export default GutterHeader
