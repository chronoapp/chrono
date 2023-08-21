import { useState, useCallback, useEffect } from 'react'
import { useCombobox } from 'downshift'
import validator from 'validator'

import { Flex, Box, FormControl, Input, Tooltip } from '@chakra-ui/react'
import debounce from 'lodash.debounce'

import * as API from '@/util/Api'
import EventParticipant from '@/models/EventParticipant'
import Participant from './Participant'

interface IProps {
  onSelect: (value: EventParticipant) => void
  maxRecommendations: number
}

function ParticipantInput(props: IProps) {
  const [searchValue, setSearchValue] = useState('')
  const [contacts, setContacts] = useState<EventParticipant[]>([])
  const [error, setError] = useState('')
  const hasError = error !== ''

  const debounceFetchContacts = useCallback(
    debounce(async (newValue) => {
      if (newValue) {
        const contacts = await API.getContacts(newValue, props.maxRecommendations)
        setContacts(contacts.map((c) => EventParticipant.fromContact(c)))
      }
    }, 300),
    []
  )

  useEffect(() => {
    debounceFetchContacts(searchValue)
  }, [searchValue])

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
    setInputValue: setSelectInput,
    inputValue,
  } = useCombobox<EventParticipant>({
    onInputValueChange({ inputValue }) {
      setSearchValue(inputValue || '')
      setError('')
    },
    items: contacts,
    selectedItem: null,
    onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
      setSearchValue('')
      newSelectedItem && props.onSelect(newSelectedItem)
    },
  })

  const handleEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (validator.isEmail(inputValue)) {
        props.onSelect(EventParticipant.fromEmail(inputValue))
        setSelectInput('')
        setSearchValue('')
        setError('')
        setContacts([])
      } else {
        setSearchValue('')
        setError('Invalid email address')
        setContacts([])
      }
    }
  }

  return (
    <FormControl width="100%" {...getComboboxProps()} isInvalid={hasError}>
      <Box onKeyDown={handleEnter}>
        <Tooltip label={error} isOpen={hasError}>
          <Input
            size={'sm'}
            variant="ghost"
            placeholder="Add guest"
            className="input-bg"
            padding={1}
            isInvalid={hasError}
            {...getInputProps()}
          ></Input>
        </Tooltip>
      </Box>

      <Flex
        {...getMenuProps()}
        mt="1"
        direction={'column'}
        bg="white"
        position={'absolute'}
        borderRadius="md"
        width={'100%'}
        boxShadow="md"
        zIndex="10"
      >
        {isOpen &&
          contacts.map((item, index) => (
            <Box
              {...getItemProps({ item, index })}
              key={`contact-${index}`}
              p="1"
              pl="3"
              pr="3"
              bg={highlightedIndex === index ? 'blue.100' : 'white'}
              borderRadius="md"
            >
              <Participant participant={item} isOrganizer={false} />
            </Box>
          ))}
      </Flex>
    </FormControl>
  )
}

ParticipantInput.defaultProps = {
  maxRecommendations: 10,
}

export default ParticipantInput
