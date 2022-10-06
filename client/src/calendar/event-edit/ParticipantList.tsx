import React from 'react'
import produce from 'immer'

import { FiX } from 'react-icons/fi'
import { Flex, Text, IconButton } from '@chakra-ui/react'

import Participant from './Participant'
import ParticipantInput from './ParticipantInput'
import EventParticipant from '@/models/EventParticipant'

interface IProps {
  readonly: boolean
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
  function renderHeading() {
    if (props.readonly) {
      return (
        <Text ml="2" alignContent={'center'}>
          {props.participants.length} guest{props.participants.length > 1 && 's'}
        </Text>
      )
    } else {
      return (
        <ParticipantInput
          onSelect={(participant) => {
            props.onUpdateParticipants(
              produce(props.participants, (draft) => {
                const exists = draft.find((p) => p.equals(participant))
                console.log('exists', exists)
                if (!exists) {
                  draft.push(participant)
                }
              })
            )
          }}
        />
      )
    }
  }

  return (
    <Flex alignItems="left" justifyContent={'left'} direction="column">
      {renderHeading()}

      <Flex
        alignItems="center"
        direction="column"
        ml="1"
        w="100%"
        maxHeight={'md'}
        overflow="scroll"
      >
        {props.participants.map((participant, idx) => (
          <Flex key={idx} mt="1" justifyContent="space-between" align="center" w="100%">
            <Participant participant={participant} />

            {!props.readonly && (
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
            )}
          </Flex>
        ))}
      </Flex>
    </Flex>
  )
}
