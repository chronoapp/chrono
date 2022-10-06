import { Flex, Avatar, Text } from '@chakra-ui/react'
import EventParticipant from '@/models/EventParticipant'

export default function Participant(props: { participant: EventParticipant }) {
  function renderDisplayName() {
    if (props.participant.display_name === props.participant.email) {
      return <Text fontSize="sm">{props.participant.display_name}</Text>
    }

    if (!props.participant.display_name && props.participant.email) {
      return <Text fontSize="sm">{props.participant.email}</Text>
    }

    return (
      <>
        <Text fontSize="sm">{props.participant.display_name}</Text>
        <Text mt="-1" fontSize="xs" textColor="GrayText" maxW="20em" noOfLines={1}>
          {props.participant.email || 'no email'}
        </Text>
      </>
    )
  }

  return (
    <Flex direction="row" align="center">
      <Avatar
        size={'xs'}
        name={props.participant.display_name || undefined}
        src={props.participant.photo_url || undefined}
        mr={2}
        mt={1}
        mb={1}
        boxSize="24px"
      />
      <Flex direction="column">{renderDisplayName()}</Flex>
    </Flex>
  )
}
