import React, { useState, useCallback } from 'react'
import { IconButton, Flex, Box } from '@chakra-ui/react'
import User from '@/models/User'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'
import { useRecoilState } from 'recoil'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTimezone } from './SortableTimezone'
import TimezonePopover from './TimezonePopover'
import * as API from '@/util/Api'

const GutterHeader = ({
  deleteTimezone,
  addTimezones,
  width,
  timezones,
  gutterWidth,
  timezonelabelRef,
}) => {
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
          {timezones.toReversed().map((timezone) => (
            <SortableTimezone
              key={timezone.id}
              timezone={timezone}
              id={timezone.id}
              gutterWidth={gutterWidth}
              onDeleteTimezone={deleteTimezone}
              allowDelete={timezones.length > 1}
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
        />
        <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
      </Flex>
    </Flex>
  )
}

function ToggleAdditionalTimezone({ addTimezones, isOpen, onOpen, onClose }) {
  return (
    <TimezonePopover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      addTimezones={addTimezones}
    />
  )
}

function ToggleExpandWeeklyRows({ expanded }) {
  const { updateExpandAllDayEvents } = useUserFlags()

  if (expanded) {
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

  function updateExpandAllDayEvents(expand) {
    const updatedFlags = { ...user?.flags, EXPAND_ALL_DAY_EVENTS: expand }

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
