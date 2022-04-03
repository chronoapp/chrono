import React from 'react'
import {
  Flex,
  Text,
  IconButton,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Kbd,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { useRouter } from 'next/router'

import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
  FiArrowLeft,
} from 'react-icons/fi'
import { EventActionContext, Display } from './EventActionContext'
import { LabelContext } from '@/contexts/LabelsContext'
import { format } from '@/util/localizer'
import { GlobalEvent } from '@/util/global'
import * as dates from '@/util/dates'

import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'

function DateHeaderSearch(props: { disableSearchMode: () => void; defaultSearchQuery: string }) {
  const router = useRouter()
  const [searchValue, setSearchValue] = React.useState<string>(props.defaultSearchQuery)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function executeSearchQuery(search: string) {
    if (search) {
      router.push(`/?search=${search}`, undefined, { shallow: true })
    }
  }

  return (
    <Flex alignItems="center" width={{ sm: '20em', md: '25em', lg: '100%' }}>
      <InputGroup mr="1" w="xl">
        <InputLeftElement>
          <IconButton
            _hover={{}}
            variant="ghost"
            aria-label="disable search"
            icon={<FiArrowLeft />}
            onClick={props.disableSearchMode}
          />
        </InputLeftElement>

        <Input
          ref={inputRef}
          size="md"
          placeholder="Search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              executeSearchQuery(searchValue)
            }
          }}
        />
        <InputRightElement>
          {searchValue && (
            <Button variant="link" onClick={() => setSearchValue('')}>
              <FiX />
            </Button>
          )}
        </InputRightElement>
      </InputGroup>

      <IconButton
        mr="1"
        variant="solid"
        aria-label="search"
        icon={<FiSearch />}
        onClick={() => {
          executeSearchQuery(searchValue)
        }}
      />
    </Flex>
  )
}

function DropdownMenu(props: { display: Display; selectDisplay: (d: Display) => void }) {
  function titleForDisplay(display: Display) {
    switch (display) {
      case 'WorkWeek': {
        return 'Work week'
      }
      default: {
        return display
      }
    }
  }

  return (
    <Menu>
      <MenuButton
        variant={'outline'}
        color="gray.600"
        borderRadius="xs"
        size="sm"
        as={Button}
        rightIcon={<FiChevronDown />}
        fontWeight="normal"
      >
        {titleForDisplay(props.display)}
      </MenuButton>

      <MenuList zIndex={2}>
        <MenuItem
          onClick={() => props.selectDisplay('Day')}
          display="flex"
          justifyContent="space-between"
        >
          <Text>Day</Text>
          <Kbd>d</Kbd>
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem
          display="flex"
          justifyContent="space-between"
          onClick={() => props.selectDisplay('Week')}
        >
          <Text>Week </Text>
          <Kbd>w</Kbd>
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem
          display="flex"
          justifyContent="space-between"
          onClick={() => props.selectDisplay('WorkWeek')}
        >
          <Text>Work week </Text>
          <Kbd>x</Kbd>
        </MenuItem>
        <MenuDivider m="0" />
        <MenuItem
          display="flex"
          justifyContent="space-between"
          onClick={() => props.selectDisplay('Month')}
        >
          <Text>Month </Text>
          <Kbd>m</Kbd>
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

/**
 * Calendar header for date selection.
 */
export default function Header(props: { search: string }) {
  const eventsContext = React.useContext(EventActionContext)
  const labelsContext = React.useContext(LabelContext)

  const [isSearchMode, setIsSearchMode] = React.useState<boolean>(!!props.search)
  const router = useRouter()

  const today = new Date()
  const display = eventsContext.display
  const title = getViewTitle(display)

  React.useEffect(() => {
    if (!props.search && isSearchMode) {
      setIsSearchMode(false)
    }
  }, [props.search])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [
    eventsContext.eventState.editingEvent,
    labelsContext.labelState.editingLabel,
    props.search,
    isSearchMode,
  ])

  function isEditing() {
    return !!eventsContext.eventState.editingEvent || labelsContext.labelState.editingLabel.active
  }

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (isSearchMode) {
      if (e.key === 'Escape') {
        e.preventDefault()

        if (eventsContext.eventState.editingEvent) {
          eventsContext.eventDispatch({ type: 'CANCEL_SELECT' })
        } else {
          setIsSearchMode(false)
          router.push(`/`, undefined, { shallow: true })
        }
      }
    } else {
      if (e.key === 'Escape') {
        e.preventDefault()
        eventsContext.eventDispatch({ type: 'CANCEL_SELECT' })
        eventsContext.onInteractionEnd()
      }

      if (!isEditing()) {
        if (e.key === 'd') {
          selectDisplay('Day')
        }

        if (e.key === 'w') {
          selectDisplay('Week')
        }

        if (e.key === 'x') {
          selectDisplay('WorkWeek')
        }

        if (e.key === 'm') {
          selectDisplay('Month')
        }
      }
    }
  }

  function getViewTitle(display: Display) {
    if (display == 'Day') {
      return format(eventsContext.selectedDate, 'LL')
    } else if (display == 'Week') {
      return Week.getTitle(eventsContext.selectedDate)
    } else if (display == 'WorkWeek') {
      return WorkWeek.getTitle(eventsContext.selectedDate)
    } else if (display == 'Month') {
      return Month.getTitle(eventsContext.selectedDate)
    }
  }

  function selectDisplay(display: Display) {
    if (display === 'Month') {
      // HACK: Prevents flicker when switching months
      eventsContext.eventDispatch({ type: 'INIT', payload: [] })
    }

    eventsContext.setDisplay(display)
  }

  /**
   * Header display when it's not in search mode.
   */
  function DateHeaderNonSearch() {
    return (
      <Flex alignItems="center">
        <Button
          variant={'outline'}
          color="gray.600"
          size="sm"
          fontWeight="normal"
          borderRadius="xs"
          onClick={() => {
            if (dates.eq(eventsContext.selectedDate, today, 'day')) {
              document.dispatchEvent(new Event(GlobalEvent.scrollToEvent))
            } else {
              eventsContext.setSelectedDate(today)
            }
          }}
        >
          Today
        </Button>

        <IconButton
          ml="1"
          aria-label="previous date range"
          variant="ghost"
          icon={<FiChevronLeft />}
          size="sm"
          onClick={() => {
            if (display == 'Day') {
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 1, 'day'))
            } else if (display == 'Week' || display == 'WorkWeek') {
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 7, 'day'))
            } else if (display == 'Month') {
              // HACK: Prevents flicker when switching months
              eventsContext.eventDispatch({ type: 'INIT', payload: [] })
              eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 1, 'month'))
            }
          }}
        />

        <IconButton
          aria-label="next date range"
          variant="ghost"
          size="sm"
          icon={<FiChevronRight />}
          onClick={() => {
            if (display == 'Day') {
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 1, 'day'))
            } else if (display == 'Week' || display == 'WorkWeek') {
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 7, 'day'))
            } else if (display == 'Month') {
              eventsContext.eventDispatch({ type: 'INIT', payload: [] })
              eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 1, 'month'))
            }
          }}
        />

        <Text pl="2" color="gray.600" fontSize={'sm'}>
          {title}
        </Text>
      </Flex>
    )
  }

  return (
    <Flex w="100%" pl="2" justifyContent="space-between" alignItems="center">
      {isSearchMode ? (
        <DateHeaderSearch
          defaultSearchQuery={props.search}
          disableSearchMode={() => {
            setIsSearchMode(false)
            router.push(`/`, undefined, { shallow: true })
          }}
        />
      ) : (
        <DateHeaderNonSearch />
      )}

      <Flex alignItems={'center'}>
        {!isSearchMode && (
          <IconButton
            mr="2"
            ml="1"
            aria-label="search"
            variant="ghost"
            h="8"
            icon={<FiSearch />}
            onClick={() => setIsSearchMode(true)}
          />
        )}
        <DropdownMenu display={display} selectDisplay={selectDisplay} />
      </Flex>
    </Flex>
  )
}
