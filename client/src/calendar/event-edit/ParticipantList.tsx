import React from 'react'
import produce from 'immer'

import { FiX } from 'react-icons/fi'
import { Button, Flex, Text, IconButton } from '@chakra-ui/react'

import Hoverable from '@/lib/Hoverable'
import Participant from './Participant'
import ParticipantInput from './ParticipantInput'
import EventParticipant from '@/models/EventParticipant'

interface IProps {
  readonly: boolean
  participants: EventParticipant[]
  onUpdateParticipants: (participants: EventParticipant[]) => void
  maxRecommendations: number
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

function getResponseStatusCounts(participants: EventParticipant[]) {
  let yesCount = 0
  let noCount = 0
  let maybeCount = 0

  for (const p of participants) {
    if (p.response_status === 'accepted') {
      yesCount++
    }
    if (p.response_status === 'declined') {
      noCount++
    }
    if (p.response_status === 'tentative') {
      maybeCount++
    }
  }

  return { yesCount, noCount, maybeCount }
}

function getResponseStatusText(participants: EventParticipant[]) {
  const { yesCount, noCount, maybeCount } = getResponseStatusCounts(participants)

  const responseText = yesCount > 0 && `${yesCount} yes`
  const noText = noCount > 0 && `${noCount} no`
  const maybeText = maybeCount > 0 && `${maybeCount} maybe`

  return [responseText, noText, maybeText].filter((t) => t).join(', ')
}

export default function ParticipantList(props: IProps) {
  function renderHeading() {
    if (props.readonly) {
      return (
        <Flex direction={'column'} ml="0.5">
          <Text alignContent={'center'} fontSize={'sm'}>
            {props.participants.length} guest{props.participants.length > 1 && 's'}
          </Text>
          <Text fontSize={'xs'} ml="0.25">
            {getResponseStatusText(props.participants)}
          </Text>
        </Flex>
      )
    } else {
      return (
        <ParticipantInput
          maxRecommendations={props.maxRecommendations}
          onSelect={(participant) => {
            props.onUpdateParticipants(
              produce(props.participants, (draft) => {
                const exists = draft.find((p) => p.equals(participant))
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

      <Flex alignItems="center" direction="column" maxHeight={'md'} overflow="auto" pt="1">
        {props.participants.map((participant, idx) => (
          <Hoverable key={idx}>
            {(isMouseInside, onMouseEnter, onMouseLeave) => (
              <Flex
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                key={idx}
                p="1"
                justifyContent="space-between"
                align="center"
                w="100%"
                bgColor={isMouseInside && 'gray.100'}
                borderRadius="md"
              >
                <Participant participant={participant} />

                {!props.readonly && isMouseInside && (
                  <Flex align="center">
                    <Flex ml="2">
                      <Button variant={'link'} size="xs">
                        mark optional
                      </Button>
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
            )}
          </Hoverable>
        ))}
      </Flex>
    </Flex>
  )
}

ParticipantList.defaultProps = {
  maxRecommendations: 10,
}
