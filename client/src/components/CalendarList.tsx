import { FiMoreHorizontal, FiTrash, FiEdit } from 'react-icons/fi'
import { Text, Flex, Button, Menu, MenuButton, MenuList, MenuItem, Portal } from '@chakra-ui/react'
import Hoverable from '@/lib/Hoverable'
import Calendar, { AccessRole } from '@/models/Calendar'

interface CalendarListProps {
  calendars: Calendar[]
  onSelectCalendar: (calendar: Calendar, selected: boolean) => void
  onRemoveFromList: (calendarId: string) => void
  onClickEdit: (calendarId: string) => void
}

function CalendarList(props: CalendarListProps) {
  const sortedCalendars = props.calendars.sort((a, b) => {
    if (a.primary && !b.primary) {
      return -5
    } else {
      return accessRolePrecedence(a.accessRole) - accessRolePrecedence(b.accessRole)
    }
  })

  return (
    <>
      {sortedCalendars.length > 0 &&
        sortedCalendars.map((calendar, idx) => {
          const selected = calendar.selected || false

          return (
            <Hoverable key={idx}>
              {(isMouseInside, onMouseEnter, onMouseLeave) => (
                <Flex onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} pl="2" pt="1" pb="1">
                  <label className="cal-checkbox-container tag-block">
                    <input
                      type="checkbox"
                      checked={selected}
                      className="cal-checkbox"
                      onChange={(v) => {
                        props.onSelectCalendar(calendar, v.target.checked)
                      }}
                    />
                    <span
                      className="cal-checkmark"
                      style={{
                        backgroundColor: selected ? calendar.backgroundColor : '#eee',
                      }}
                    ></span>
                  </label>

                  <Flex
                    align="center"
                    justifyContent="space-between"
                    w="100%"
                    whiteSpace={'nowrap'}
                  >
                    <Text
                      userSelect="none"
                      fontSize="sm"
                      color={'gray.700'}
                      pl="2"
                      overflow={'hidden'}
                    >
                      {calendar.summary}
                    </Text>

                    {isMouseInside && (
                      <Menu isLazy gutter={-1}>
                        <MenuButton
                          height="100%"
                          variant="unstyled"
                          color="gray.600"
                          size="xs"
                          as={Button}
                        >
                          <FiMoreHorizontal size={'1.25em'} />
                        </MenuButton>

                        <Portal>
                          <MenuList>
                            <MenuItem
                              fontSize={'sm'}
                              onClick={() => {
                                props.onClickEdit(calendar.id)
                                onMouseLeave()
                              }}
                              icon={<FiEdit />}
                              iconSpacing="1"
                            >
                              Edit
                            </MenuItem>
                            <MenuItem
                              fontSize={'sm'}
                              onClick={() => {
                                props.onRemoveFromList(calendar.id)
                                onMouseLeave()
                              }}
                              icon={<FiTrash />}
                              iconSpacing="1"
                            >
                              Remove from list
                            </MenuItem>
                          </MenuList>
                        </Portal>
                      </Menu>
                    )}
                  </Flex>
                </Flex>
              )}
            </Hoverable>
          )
        })}
    </>
  )
}

function accessRolePrecedence(accessRole: AccessRole) {
  if (accessRole === 'owner') {
    return 0
  } else if (accessRole == 'writer') {
    return 1
  } else if (accessRole == 'reader') {
    return 2
  } else {
    return 3
  }
}

export default CalendarList
