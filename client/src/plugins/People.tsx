import * as React from 'react'
import { Flex, Text, Avatar, Input, InputGroup, InputRightElement, Button } from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

import * as dates from '@/util/dates'
import * as API from '@/util/Api'
import { formatTimeAgo } from '@/util/localizer'
import ContactInEvent from '@/models/ContactInEvent'

function ContactInEventRow(props: { contact: ContactInEvent }) {
  const { contact } = props
  const displayName = contact.contact.displayName || contact.contact.email
  const today = new Date()
  const lastSeenSeconds = dates.diff(today, contact.last_seen, 'seconds')
  const lastSeenAgo = formatTimeAgo(lastSeenSeconds)

  return (
    <Flex borderRadius={'sm'} direction={'row'} mb="4">
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
        <Text fontSize="sm" color={'gray.700'}>
          last met {lastSeenAgo} ago
        </Text>
      </Flex>
    </Flex>
  )
}

export default function People() {
  const [contacts, setContacts] = React.useState<ContactInEvent[]>([])
  const [searchQuery, setSearchQuery] = React.useState<string>('')

  React.useEffect(() => {
    async function getContacts() {
      const contacts = await API.getContactsInEvent()
      setContacts(contacts)
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

      <Flex direction={'column'} mb="2" mt="4" overflowY={'scroll'} maxH={'2xl'}>
        {filteredContacts.map((contact, idx) => {
          return <ContactInEventRow key={idx} contact={contact} />
        })}
      </Flex>
    </Flex>
  )
}
