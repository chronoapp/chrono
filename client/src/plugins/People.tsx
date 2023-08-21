import * as React from 'react'
import { Flex, Text, Avatar } from '@chakra-ui/react'

import * as API from '@/util/Api'
import ContactInEvent from '@/models/ContactInEvent'

function ContactInEventRow(props: { contact: ContactInEvent }) {
  const { contact } = props
  const displayName = contact.contact.displayName || contact.contact.email

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
      </Flex>
    </Flex>
  )
}

export default function People() {
  const [contacts, setContacts] = React.useState<ContactInEvent[]>([])

  React.useEffect(() => {
    async function getContacts() {
      const contacts = await API.getContactsInEvent()
      setContacts(contacts)
    }
    getContacts()
  }, [])

  return (
    <Flex direction={'column'} overflowY={'auto'}>
      {contacts.map((contact, idx) => {
        return <ContactInEventRow key={idx} contact={contact} />
      })}
    </Flex>
  )
}
