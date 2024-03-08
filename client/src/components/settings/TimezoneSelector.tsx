import { useState, useRef } from 'react'
import { useCombobox } from 'downshift'
import { useVirtual } from 'react-virtual'

import { Box, Flex, Text, Input, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

import User from '@/models/User'
import { default as allTimezones, TimeZone } from 'timezones-list'

interface IProps {
  user: User
}

export default function TimezoneSelector(props: IProps) {
  function estimateSize() {
    return 45
  }

  function getTimezoneFilter(inputValue: string) {
    return function timezoneFilter(timezone: TimeZone) {
      const inputValueLowerCase = inputValue.toLowerCase()

      return (
        timezone.name.toLowerCase().includes(inputValueLowerCase) ||
        timezone.label.toLowerCase().includes(inputValueLowerCase)
      )
    }
  }

  function TimezoneComboBox() {
    const [inputValue, setInputValue] = useState('')
    const [selectedItem, setSelectedItem] = useState<TimeZone | null | undefined>(
      allTimezones.find((item) => item.tzCode === props.user.timezone)
    )

    const [timezones, setTimezones] = useState(allTimezones)
    const listRef = useRef<HTMLObjectElement>(null)

    const rowVirtualizer = useVirtual({
      size: timezones.length,
      parentRef: listRef,
      overscan: 2,
      estimateSize,
    })

    const {
      isOpen,
      getComboboxProps,
      getToggleButtonProps,
      getMenuProps,
      highlightedIndex,
      getItemProps,
      getInputProps,
      openMenu,
    } = useCombobox({
      items: timezones,
      initialSelectedItem: selectedItem,
      itemToString: (item: TimeZone | null) => (item ? item.name : ''),
      onInputValueChange: ({ inputValue }) => {
        setInputValue(inputValue || '')

        const filteredTimezones = !inputValue
          ? allTimezones
          : allTimezones.filter(getTimezoneFilter(inputValue))

        setTimezones(filteredTimezones)
      },
      onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
        setInputValue(newSelectedItem ? newSelectedItem.name : '')
        setSelectedItem(newSelectedItem)
      },
      scrollIntoView: () => {},
      onHighlightedIndexChange: ({ highlightedIndex, type }) => {
        if (type !== useCombobox.stateChangeTypes.MenuMouseLeave && highlightedIndex) {
          rowVirtualizer.scrollToIndex(highlightedIndex)
        }
      },
    })

    return (
      <Box {...getComboboxProps()} position="relative" width="20em">
        <InputGroup size="sm">
          <Input
            {...getInputProps({
              onBlur: () => {
                // Ensure the input is reset to show the selected item if it exists
                if (selectedItem) {
                  setInputValue(selectedItem.name)
                }
              },
              value: inputValue,
              onChange: (e) => {
                setInputValue((e.target as HTMLInputElement).value)
              },
              onFocus: () => {
                // Show all items when the input is focused
                setTimezones(allTimezones)
                openMenu()
              },
            })}
            variant="filled"
            placeholder={'timezone'}
          />

          <InputRightElement>
            {isOpen ? (
              <IconButton
                {...getToggleButtonProps()}
                icon={<FiChevronUp />}
                aria-label="close timezone select"
              />
            ) : (
              <IconButton
                {...getToggleButtonProps()}
                icon={<FiChevronDown />}
                aria-label="open timezone select"
              />
            )}
          </InputRightElement>
        </InputGroup>

        <Box
          maxH={'lg'}
          overflowY="auto"
          bg="white"
          border="1px solid #ccc"
          position="absolute"
          width="100%"
          zIndex="1000"
          mt="0"
          style={{ display: isOpen ? 'block' : 'none' }}
          {...getMenuProps({ ref: listRef })}
        >
          {isOpen && (
            <>
              <li key="total-size" style={{ height: rowVirtualizer.totalSize }} />
              {rowVirtualizer.virtualItems.map((virtualRow) => (
                <Flex
                  {...getItemProps({
                    index: virtualRow.index,
                    item: timezones[virtualRow.index],
                  })}
                  key={timezones[virtualRow.index].tzCode}
                  bg={highlightedIndex === virtualRow.index ? 'lightgray' : 'white'}
                  fontWeight={highlightedIndex === virtualRow.index ? 'bold' : 'normal'}
                  cursor="pointer"
                  fontSize={'xs'}
                  p="1"
                  position="absolute"
                  top={0}
                  left={0}
                  width={'100%'}
                  height={virtualRow.size}
                  transform={`translateY(${virtualRow.start}px)`}
                  borderStyle="solid none none none"
                  borderWidth="1px"
                  borderColor={'gray.100'}
                  alignItems={'center'}
                >
                  {timezones[virtualRow.index].name}
                </Flex>
              ))}
            </>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box mt="2" alignItems={'center'}>
      <Text fontSize={'sm'} mr="1" fontWeight={500}>
        Time zone
      </Text>

      <TimezoneComboBox />
    </Box>
  )
}
