import React from 'react'
import produce from 'immer'

import { FiX } from 'react-icons/fi'
import { Flex, Avatar, Text, IconButton } from '@chakra-ui/react'

import EventParticipant from '@/models/EventParticipant'

interface IProps {
  participants: Partial<EventParticipant>[]
  onUpdateParticipants: (participants: Partial<EventParticipant>[]) => void
}

export default function ParticipantList(props: IProps) {
  return (
    <Flex spacing={2} direction="column">
      {props.participants.map((participant, idx) => (
        <Flex mb="2" justifyContent="space-between" align="center" w="20em">
          <Flex direction="row" align="center">
            {participant.photo_url && (
              <Avatar size={'xs'} src={participant.photo_url} mr={2} mt={1} mb={1} boxSize="24px" />
            )}
            <Flex direction="column">
              <Text fontSize="xs">{participant.display_name}</Text>
              <Text mt="-1" fontSize="xs" textColor="GrayText">
                {participant.email || 'no email'}
              </Text>
            </Flex>
          </Flex>
          <Flex align="center">
            <Flex ml="2">
              <Text fontSize="xs" textColor="GrayText">
                Optional
              </Text>
            </Flex>

            <IconButton
              alignSelf="right"
              aria-label="Remove Participant"
              icon={<FiX />}
              size="sm"
              variant="link"
              onClick={() => {
                const updatedParticipants = produce(props.participants, (draft) => {
                  return draft.filter((p) => p.id !== participant.id)
                })
                props.onUpdateParticipants(updatedParticipants)
              }}
            />
          </Flex>
        </Flex>
      ))}
    </Flex>
  )
}
