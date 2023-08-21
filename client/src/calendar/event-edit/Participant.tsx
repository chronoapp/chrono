import { Box, Flex, Avatar, Text, Icon } from '@chakra-ui/react'
import { AiFillCheckCircle } from 'react-icons/ai'
import { RiQuestionFill } from 'react-icons/ri'
import { FiXCircle } from 'react-icons/fi'

import EventParticipant from '@/models/EventParticipant'
import Calendar from '@/models/Calendar'

interface IProps {
  participant: EventParticipant
  isOrganizer: boolean
}

export default function Participant(props: IProps) {
  const secondaryText: string[] = []
  if (props.isOrganizer) {
    secondaryText.push('Organizer')
  }

  if (props.participant.is_optional) {
    secondaryText.push('Optional')
  }

  const isOptionalText = secondaryText.length > 0 && (
    <Text mt="-1" fontSize="xs" textColor="GrayText">
      {secondaryText.join(', ')}
    </Text>
  )

  function renderDisplayName() {
    if (props.participant.display_name === props.participant.email) {
      return (
        <>
          <Text fontSize="sm">{props.participant.display_name}</Text>
          {isOptionalText}
        </>
      )
    }

    if (!props.participant.display_name && props.participant.email) {
      return (
        <>
          <Text fontSize="sm">{props.participant.email}</Text>
          {isOptionalText}
        </>
      )
    }

    return (
      <>
        <Flex alignItems={'center'}>
          <Text fontSize="sm">{props.participant.display_name}</Text>
        </Flex>
        <Text mt="-1" fontSize="xs" textColor="GrayText" maxW="15em" noOfLines={1}>
          {props.participant.email}
        </Text>
        {isOptionalText}
      </>
    )
  }

  return (
    <Flex direction="row" align="center">
      <ParticipantAvatar participant={props.participant} />
      <Flex ml="2" direction="column">
        {renderDisplayName()}
      </Flex>
    </Flex>
  )
}

function ParticipantAvatar(props: { participant: EventParticipant }) {
  return (
    <Flex align="center" position={'relative'}>
      <Avatar
        size={'xs'}
        bgColor="gray"
        name={props.participant.display_name || undefined}
        src={props.participant.photo_url || undefined}
        mt="0.5"
        mb="0.5"
        boxSize="24px"
      />
      {props.participant.response_status === 'accepted' && (
        <Box position="absolute" h="3" w="3" right="0" bottom="0" color="green.500">
          <Icon bgColor="white" as={AiFillCheckCircle} borderRadius="lg"></Icon>
        </Box>
      )}
      {props.participant.response_status === 'tentative' && (
        <Box position="absolute" h="3" w="3" right="0" bottom="0" color="gray.400">
          <Icon bgColor="white" as={RiQuestionFill} borderRadius="lg"></Icon>
        </Box>
      )}
      {props.participant.response_status === 'declined' && (
        <Box position="absolute" h="3" w="3" right="0" bottom="0">
          <Icon bgColor="white" color="red" as={FiXCircle} borderRadius="lg"></Icon>
        </Box>
      )}
    </Flex>
  )
}
