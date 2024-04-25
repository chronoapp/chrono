import { IconButton, Flex } from '@chakra-ui/react'
import User from '@/models/User'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'
import { useRecoilState } from 'recoil'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTimezone } from './SortableTimezone'

import * as API from '@/util/Api'

function ToggleAdditionalTimezone({ addTimezones }) {
  return (
    <IconButton
      size={'xs'}
      variant="ghost"
      aria-label="adding additional timezones"
      icon={<FiPlus />}
      onClick={() => addTimezones()}
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
      />
    )
  }
}

const GutterHeader = ({ addTimezones, width, timezones, gutterWidth, activeId }) => {
  const { expandAllDayEvents, updateExpandAllDayEvents } = useUserFlags()

  return (
    <Flex
      className="rbc-label cal-time-header-gutter"
      width={width}
      justifyContent="flex-end"
      position="sticky"
      flexDirection="column"
    >
      <Flex marginLeft="-5px">
        <SortableContext items={timezones} strategy={horizontalListSortingStrategy}>
          {timezones.map((timezone) => (
            <SortableTimezone key={timezone.id} id={timezone.id} gutterWidth={gutterWidth} />
          ))}
        </SortableContext>
      </Flex>

      <Flex justifyContent="flex-end" mt="10px">
        <ToggleAdditionalTimezone addTimezones={addTimezones} />
        <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
      </Flex>
    </Flex>
  )
}
function useUserFlags() {
  const [user, setUser] = useRecoilState(userState)
  const expandAllDayEvents = user?.flags.EXPAND_ALL_DAY_EVENTS || false

  function updateExpandAllDayEvents(expand: boolean) {
    const updatedFlags = { ...user?.flags, EXPAND_ALL_DAY_EVENTS: expand }

    // Update local state
    setUser((state) =>
      state
        ? ({
            ...state,
            flags: updatedFlags,
          } as User)
        : state
    )

    if (user) {
      API.updateUserFlags('EXPAND_ALL_DAY_EVENTS', expand)
    }
  }

  return { expandAllDayEvents, updateExpandAllDayEvents }
}

export default GutterHeader
