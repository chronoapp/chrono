import React, { useState, useCallback } from 'react'
import { IconButton, Flex } from '@chakra-ui/react'
import User from '@/models/User'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'
import { useRecoilState } from 'recoil'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTimezone } from './SortableTimezone'
import TimezoneModal from './TimezoneModal'
import * as API from '@/util/Api'
/**
 * The `GutterHeader` component serves as the control interface for managing and displaying sortable time zones
 */

const GutterHeader = ({ addTimezones, width, timezones, gutterWidth, timezonelabelRef }) => {
  const [user] = useRecoilState(userState)
  const { expandAllDayEvents } = useUserFlags()
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <Flex
      className="rbc-label cal-time-header-gutter"
      width={width}
      justifyContent="flex-end"
      position="sticky"
      flexDirection="column"
    >
      <Flex marginLeft="-5px" ref={timezonelabelRef}>
        <SortableContext items={timezones} strategy={horizontalListSortingStrategy}>
          {/* Creates a reversed copy of the timezone state to ensure the primary time is closest to
        the calendar. */}
          {timezones.toReversed().map((timezone) => (
            <SortableTimezone
              key={timezone.id}
              timezone={timezone}
              id={timezone.id}
              gutterWidth={gutterWidth}
            />
          ))}
        </SortableContext>
      </Flex>

      <Flex justifyContent="flex-end" mt="10px">
        <ToggleAdditionalTimezone
          addTimezones={addTimezones}
          isOpen={isOpen}
          onOpen={handleOpen}
          onClose={handleClose}
          user={user}
        />
        <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
      </Flex>
    </Flex>
  )
}

/**
 * Buttons for add timezones and to expand all day events
 */
function ToggleAdditionalTimezone({ addTimezones, isOpen, onOpen, onClose, user }) {
  return (
    <>
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="adding additional timezones"
        icon={<FiPlus />}
        onClick={onOpen}
        width="4"
      />
      <TimezoneModal isOpen={isOpen} onClose={onClose} addTimezones={addTimezones} user={user} />
    </>
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
