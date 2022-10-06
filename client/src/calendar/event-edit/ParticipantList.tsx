import React from 'react'
import produce from 'immer'

import { FiX } from 'react-icons/fi'
import { Flex, Text, IconButton } from '@chakra-ui/react'

import Participant from './Participant'
import EventParticipant from '@/models/EventParticipant'

interface IProps {
  participants: EventParticipant[]
  onUpdateParticipants: (participants: EventParticipant[]) => void
}

export function getParticipantDiff(before: EventParticipant[], after: EventParticipant[]) {
  const added = after.filter((afterParticipant) => {
    return !before.some((beforeParticipant) => {
      return beforeParticipant.equals(afterParticipant)
    })
  })

  const removed = before.filter((beforeParticipant) => {
    return !after.some((afterParticipant) => {
      return afterParticipant.equals(beforeParticipant)
    })
  })

  return { added, removed }
}

export default function ParticipantList(props: IProps) {
  return (
    <Flex direction="column" ml="2" w="100%" maxHeight={'md'} overflow="scroll">
      {props.participants.map((participant, idx) => (
        <Flex key={idx} mb="2" justifyContent="space-between" align="center" w="100%">
          <Participant participant={participant} />

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
                  return draft.filter((p) => {
                    return !participant.equals(p)
                  })
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
