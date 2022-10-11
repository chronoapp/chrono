import React from 'react'
import produce from 'immer'

import { FiX } from 'react-icons/fi'
import { Button, Flex, Text, IconButton } from '@chakra-ui/react'
import Hoverable from '@/lib/Hoverable'

import EventParticipant from '@/models/EventParticipant'
import Calendar from '@/models/Calendar'

import { mergeParticipants } from './EventEditUtils'
import Participant from './Participant'
import ParticipantInput from './ParticipantInput'

interface IProps {
  readonly: boolean
  calendar: Calendar
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
  let awaitingCount = 0

  for (const p of participants) {
    if (p.response_status === 'accepted') {
      yesCount++
    } else if (p.response_status === 'declined') {
      noCount++
    } else if (p.response_status === 'tentative') {
      maybeCount++
    } else {
      awaitingCount++
    }
  }

  return { yesCount, noCount, maybeCount, awaitingCount }
}

function getResponseStatusText(participants: EventParticipant[]) {
  const { yesCount, noCount, maybeCount, awaitingCount } = getResponseStatusCounts(participants)

  const responseText = yesCount > 0 && `${yesCount} yes`
  const noText = noCount > 0 && `${noCount} no`
  const maybeText = maybeCount > 0 && `${maybeCount} maybe`
  const awaitingText = awaitingCount > 0 && `${awaitingCount} awaiting`

  return [responseText, noText, maybeText, awaitingText].filter((t) => t).join(', ')
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
            const updatedParticipants = mergeParticipants(props.calendar, props.participants, [
              participant,
            ])
            props.onUpdateParticipants(updatedParticipants)
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
                <Participant calendar={props.calendar} participant={participant} />

                {!props.readonly && isMouseInside && (
                  <Flex align="center">
                    <Flex ml="2">
                      <Button
                        variant={'link'}
                        size="xs"
                        onClick={() => {
                          const updatedParticipants = produce(props.participants, (draft) => {
                            for (let p of draft) {
                              if (p.equals(participant)) {
                                p.is_optional = !p.is_optional
                              }
                            }
                          })
                          props.onUpdateParticipants(updatedParticipants)
                        }}
                      >
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
