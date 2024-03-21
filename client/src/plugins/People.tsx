import * as React from 'react'
import {
  Flex,
  Text,
  Avatar,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Center,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

import { formatTimeAgo } from '@/util/localizer-luxon'
import * as dates from '@/util/dates-luxon'

import * as API from '@/util/Api'
import ContactInEvent from '@/models/ContactInEvent'
import { DateTime } from 'luxon'

function ContactInEventRow(props: { contact: ContactInEvent }) {
  const { contact } = props
  const displayName = contact.contact.displayName || contact.contact.email

  const today = DateTime.now()
  const lastSeenSeconds = contact.last_seen ? dates.diff(today, contact.last_seen, 'seconds') : null
  const lastSeenAgo = lastSeenSeconds ? formatTimeAgo(lastSeenSeconds) : null

  return (
    <Flex borderRadius={'sm'} direction={'row'} mb="4" alignItems={'center'}>
      <Avatar
        size={'xs'}
        bgColor="gray"
        name={contact.contact.displayName || undefined}
        src={contact.contact.photoUrl || undefined}
        mt="0.5"
        mb="0.5"
        boxSize="24px"
      />
      <Flex ml="2" direction="column">
        <Text fontSize="sm">{displayName}</Text>
        {lastSeenAgo && (
          <Text fontSize="sm" color={'gray.700'}>
            last met {lastSeenAgo} ago
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

export default function People() {
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [contacts, setContacts] = React.useState<ContactInEvent[]>([])
  const [searchQuery, setSearchQuery] = React.useState<string>('')

  React.useEffect(() => {
    async function getContacts() {
      const contacts = await API.getContactsInEvent()
      setContacts(contacts)
      setIsLoading(false)
    }
    getContacts()
  }, [])

  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.contact.firstName} ${contact.contact.lastName} ${contact.contact.email}}`
    return fullName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <Flex direction={'column'}>
      <InputGroup size={'sm'}>
        <Input
          placeholder="Search"
          onChange={(e) => {
            setSearchQuery(e.target.value)
          }}
        />
        {searchQuery && (
          <InputRightElement pr="1">
            <Button
              aria-label="clear search"
              variant={'unstyled'}
              onClick={() => {
                setSearchQuery('')
              }}
            >
              <FiX />
            </Button>
          </InputRightElement>
        )}
      </InputGroup>

      {!isLoading && filteredContacts.length == 0 ? (
        <Center w="100%" h="2xl" overflow="auto">
          <Text color="gray.700">We couldn't find any contacts</Text>
        </Center>
      ) : (
        <Flex direction={'column'} mb="2" mt="4" overflowY={'scroll'} maxH={'2xl'}>
          {filteredContacts.map((contact, idx) => {
            return <ContactInEventRow key={idx} contact={contact} />
          })}
        </Flex>
      )}
    </Flex>
  )
}
