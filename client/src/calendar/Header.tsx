import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'

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

import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
  FiArrowLeft,
} from 'react-icons/fi'

import { format } from '@/util/localizer'
import { GlobalEvent } from '@/util/global'
import * as dates from '@/util/dates'

import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import { labelsState } from '@/state/LabelsState'
import useEventActions from '@/state/useEventActions'
import { displayState, editingEventState, DisplayView } from '@/state/EventsState'

function DateHeaderSearch(props: { disableSearchMode: () => void; defaultSearchQuery: string }) {
  const navigate = useNavigate()

  const [searchValue, setSearchValue] = React.useState<string>(props.defaultSearchQuery)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function executeSearchQuery(search: string) {
    if (search) {
      navigate({ search: `?search=${search}` })
    }
  }

  return (
    <Flex alignItems="center" width={{ sm: '20em', md: '25em', lg: '30em' }}>
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

function DropdownMenu(props: { display: DisplayView; selectDisplay: (d: DisplayView) => void }) {
  function titleForDisplay(display: DisplayView) {
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
 * Header display when it's not in search mode.
 */
function DateHeaderNonSearch(props: {
  title: string | undefined
  onSelectToday: () => void
  onSelectPrevious: () => void
  onSelectNext: () => void
}) {
  return (
    <Flex alignItems="center">
      <Button
        color="gray.600"
        size="sm"
        fontWeight="normal"
        borderRadius="xs"
        onClick={props.onSelectToday}
      >
        Today
      </Button>

      <IconButton
        ml="1"
        aria-label="previous date range"
        variant="ghost"
        icon={<FiChevronLeft />}
        size="sm"
        onClick={props.onSelectPrevious}
      />

      <IconButton
        aria-label="next date range"
        variant="ghost"
        size="sm"
        icon={<FiChevronRight />}
        onClick={props.onSelectNext}
      />

      <Text pl="2" color="gray.600" fontSize={'sm'}>
        {props.title}
      </Text>
    </Flex>
  )
}

/**
 * Calendar header for date selection.
 */
export default function Header(props: { search: string }) {
  const eventActions = useEventActions()
  const navigate = useNavigate()

  const [display, setDisplay] = useRecoilState(displayState)
  const editingEvent = useRecoilValue(editingEventState)
  const labels = useRecoilValue(labelsState)
  const [isSearchMode, setIsSearchMode] = React.useState<boolean>(!!props.search)

  const title = getViewTitle(display.view)

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
  }, [editingEvent, labels.editingLabel, props.search, isSearchMode])

  function isEditing() {
    return !!editingEvent || labels.editingLabel.active
  }

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (isSearchMode) {
      if (e.key === 'Escape') {
        e.preventDefault()

        if (editingEvent) {
          eventActions.cancelSelect()
        } else {
          setIsSearchMode(false)
          navigate({ pathname: '/', search: '' })
        }
      }
    } else {
      if (e.key === 'Escape') {
        e.preventDefault()
        eventActions.cancelSelect()
        eventActions.onInteractionEnd()
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

  function getViewTitle(displayView: DisplayView) {
    if (displayView == 'Day') {
      return format(display.selectedDate, 'LL')
    } else if (displayView == 'Week') {
      return Week.getTitle(display.selectedDate)
    } else if (displayView == 'WorkWeek') {
      return WorkWeek.getTitle(display.selectedDate)
    } else if (displayView == 'Month') {
      return Month.getTitle(display.selectedDate)
    }
  }

  function selectDisplay(view: DisplayView) {
    if (view === 'Month') {
      // HACK: Prevents flicker when switching months
      eventActions.initEvents({})
    }

    setDisplay((display) => ({ ...display, view: view }))
  }

  function onSelectToday() {
    const today = new Date()

    if (dates.eq(display.selectedDate, today, 'day')) {
      document.dispatchEvent(new Event(GlobalEvent.scrollToEvent))
    } else {
      setDisplay((display) => ({ ...display, selectedDate: today }))
    }
  }

  function onSelectPrevious() {
    if (display.view == 'Day') {
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.subtract(display.selectedDate, 1, 'day'),
      }))
    } else if (display.view == 'Week' || display.view == 'WorkWeek') {
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.subtract(display.selectedDate, 7, 'day'),
      }))
    } else if (display.view == 'Month') {
      // HACK: Prevents flicker when switching months
      eventActions.initEvents({})
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.subtract(display.selectedDate, 1, 'month'),
      }))
    }
  }

  function onSelectNext() {
    if (display.view == 'Day') {
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.add(display.selectedDate, 1, 'day'),
      }))
    } else if (display.view == 'Week' || display.view == 'WorkWeek') {
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.add(display.selectedDate, 7, 'day'),
      }))
    } else if (display.view == 'Month') {
      eventActions.initEvents({})
      setDisplay((display) => ({
        ...display,
        selectedDate: dates.add(display.selectedDate, 1, 'month'),
      }))
    }
  }

  const DateHeader = React.useMemo(
    () => (
      <DateHeaderNonSearch
        title={title}
        onSelectToday={onSelectToday}
        onSelectPrevious={onSelectPrevious}
        onSelectNext={onSelectNext}
      />
    ),
    [display]
  )

  return (
    <Flex w="100%" pl="2" justifyContent="space-between" alignItems="center">
      {isSearchMode ? (
        <DateHeaderSearch
          defaultSearchQuery={props.search}
          disableSearchMode={() => {
            setIsSearchMode(false)
            navigate({ pathname: '/', search: '' })
          }}
        />
      ) : (
        DateHeader
      )}

      <Flex alignItems={'center'}>
        {!isSearchMode && (
          <IconButton
            mr="2"
            ml="1"
            aria-label="search"
            h="8"
            icon={<FiSearch />}
            onClick={() => setIsSearchMode(true)}
          />
        )}
        <DropdownMenu display={display.view} selectDisplay={selectDisplay} />
      </Flex>
    </Flex>
  )
}
