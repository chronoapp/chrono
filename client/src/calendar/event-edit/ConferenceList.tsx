import { FiChevronDown, FiX, FiExternalLink, FiPhone } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'

import {
  Box,
  IconButton,
  Image,
  Menu,
  Button,
  MenuButton,
  MenuList,
  MenuItem,
  Flex,
  Text,
  Link,
  BoxProps,
} from '@chakra-ui/react'

import GoogleMeetLogo from '@/assets/google-meet.svg'
import ZoomLogo from '@/assets/zoom-app.svg'

import Event from '@/models/Event'
import User, { VideoMeetType } from '@/models/User'
import { userState } from '@/state/UserState'

import ConferenceData, { ConferenceKeyType } from '@/models/ConferenceData'

import ConferenceEntryPoint from '@/models/ConferenceEntrypoint'

/**
 * Represents a conference service that can be selected by the user.
 *
 * Since we don't handle conferencing like zoom by default,
 * we merge it from the existing conference data.
 */
export interface ConferenceItem {
  title: string
  type: VideoMeetType
  logo: string
  conferenceData: ConferenceData | null
}

interface IProps extends BoxProps {
  event: Event
  conferenceData: ConferenceData | null
  readonly: boolean
  onSelectConference?: (conferenceData: ConferenceData | null) => void
}

// These are the supported conference services.

const googleMeetConference: ConferenceItem = {
  title: 'Google meet',
  type: 'google',
  logo: GoogleMeetLogo,
  conferenceData: null,
}

const zoomConference: ConferenceItem = {
  title: 'Zoom',
  type: 'zoom',
  logo: ZoomLogo,
  conferenceData: null,
}

function videoMeetType(type: ConferenceKeyType): VideoMeetType {
  if (type === 'hangoutsMeet') {
    return 'google'
  } else {
    return 'other'
  }
}

/**
 * Get the selectable list of conference services.
 *
 * If there is an existing conference for the existing event,
 * merge our conferencing choices with the existing conference data.
 */
function getConferenceList(user: User, conferenceData: ConferenceData | null): ConferenceItem[] {
  const conferenceList: ConferenceItem[] = []

  // If there is an existing conference, add it to the list.
  if (conferenceData && conferenceData.conference_solution) {
    conferenceList.push({
      title: conferenceData.conference_solution.name,
      type: videoMeetType(conferenceData.conference_solution.key_type),
      logo: conferenceData.conference_solution.icon_uri,
      conferenceData: conferenceData,
    })
  }

  User.getVideoMeetTypes(user).forEach((type) => {
    // Only show the meeting option if they are not already selected.
    if (type === 'google') {
      const isGoogleHangout = conferenceData?.conference_solution?.key_type === 'hangoutsMeet'
      if (!conferenceData || !isGoogleHangout) {
        conferenceList.push(googleMeetConference)
      }
    } else if (type === 'zoom') {
      if (!conferenceData || !isZoomMeeting(conferenceData)) {
        conferenceList.push(zoomConference)
      }
    }
  })

  return conferenceList.sort((a, b) => {
    if (a.title < b.title) {
      return -1
    } else if (a.title > b.title) {
      return 1
    } else {
      return 0
    }
  })
}

function isZoomMeeting(conferenceData: ConferenceData) {
  return (
    conferenceData.conference_solution?.name.includes('Zoom') &&
    conferenceData.conference_solution?.key_type === 'addOn'
  )
}

function getSelectedConference(
  conferenceList: ConferenceItem[],
  conferenceData: ConferenceData
): ConferenceItem {
  if (conferenceData?.create_request?.conference_solution_key_type === 'hangoutsMeet') {
    return conferenceList.find((conference) => conference.type === 'google')!
  } else if (conferenceData?.create_request?.conference_solution_key_type === 'zoom') {
    return conferenceList.find((conference) => conference.type === 'zoom')!
  } else {
    return conferenceList.find(
      (conference) =>
        conference.conferenceData &&
        conference.conferenceData.conference_id === conferenceData?.conference_id
    )!
  }
}

/**
 * Merges the selected conference with the conference data.
 */
function getSelectedConferenceItem(
  conferenceList: ConferenceItem[],
  conferenceData: ConferenceData
) {
  const conference = getSelectedConference(conferenceList, conferenceData)

  return {
    ...conference,
    conferenceData: conferenceData,
  }
}

function ConferenceList(props: IProps) {
  const { conferenceData, readonly, onSelectConference, ...boxProps } = props

  const user = useRecoilValue(userState)

  // Merged list of selectable conferences.
  const conferenceList = getConferenceList(user!, conferenceData)

  const selectedConference = conferenceData
    ? getSelectedConferenceItem(conferenceList, conferenceData)
    : null

  return (
    <Flex direction={'column'} {...boxProps}>
      {!readonly && (
        <Box>
          <Menu>
            {selectedConference ? (
              <MenuButton as={Button}>
                <Flex>
                  <Image boxSize="1em" src={selectedConference.logo} mr="0.5em" />
                  <span>{selectedConference.title}</span>
                </Flex>
              </MenuButton>
            ) : (
              <MenuButton
                as={Button}
                variant="ghost"
                rightIcon={<FiChevronDown />}
                fontWeight={'normal'}
              >
                Add conferencing
              </MenuButton>
            )}

            <MenuList mt="-1" p="0">
              {conferenceList.map((conference, idx) => (
                <MenuItem
                  fontSize="sm"
                  key={idx}
                  onClick={async () => {
                    if (conference.conferenceData) {
                      onSelectConference!(conference.conferenceData)
                    } else if (conference.type === 'google') {
                      onSelectConference!(ConferenceData.newHangoutsMeet())
                    } else if (conference.type === 'zoom') {
                      onSelectConference!(ConferenceData.newZoomMeet())
                    }
                  }}
                >
                  <Image boxSize="1em" src={conference.logo} mr="0.5em" />
                  <span>{conference.title}</span>
                </MenuItem>
              ))}
            </MenuList>
          </Menu>

          {selectedConference && (
            <IconButton
              variant={'ghost'}
              ml="0.5"
              size="sm"
              aria-label="Remove video conferencing"
              onClick={() => {
                onSelectConference!(null)
              }}
              icon={<FiX />}
            />
          )}
        </Box>
      )}

      {selectedConference && (
        <ConferenceDetails
          selectedVideoConference={selectedConference}
          eventCreated={props.event.syncStatus === 'SYNCED'}
        />
      )}
    </Flex>
  )
}

function ConferenceDetails(props: {
  selectedVideoConference: ConferenceItem
  eventCreated: boolean
}) {
  if (!props.selectedVideoConference) {
    return null
  }

  const conferenceData = props.selectedVideoConference.conferenceData
  if (!conferenceData) {
    return null
  }

  const entryPoints = conferenceData.entry_points
    .filter((x) => x.entry_point_type !== 'sip')
    .sort((a, b) => {
      const order = ['video', 'phone', 'more']
      const typeAIndex = order.indexOf(a.entry_point_type)
      const typeBIndex = order.indexOf(b.entry_point_type)

      if (typeAIndex < typeBIndex) {
        return -1
      } else if (typeAIndex > typeBIndex) {
        return 1
      } else {
        return 0
      }
    })

  return (
    <Box>
      {entryPoints.map((entryPoint, idx) => (
        <Flex key={idx} mt="1">
          {renderMeetingEntryPoints(conferenceData, entryPoint)}
        </Flex>
      ))}
    </Box>
  )

  function renderMeetingEntryPoints(
    conferenceData: ConferenceData,
    entryPoint: ConferenceEntryPoint
  ) {
    if (entryPoint.entry_point_type === 'phone') {
      return <PhoneEntryPoint entryPoint={entryPoint} />
    } else if (entryPoint.entry_point_type === 'more') {
      return <MoreEntryPoint entryPoint={entryPoint} />
    } else if (entryPoint.entry_point_type === 'video') {
      return (
        <VideoEntryPoint
          conferenceData={conferenceData}
          entryPoint={entryPoint}
          eventCreated={props.eventCreated}
        />
      )
    }
  }
}

function VideoEntryPoint(props: {
  conferenceData: ConferenceData
  entryPoint: ConferenceEntryPoint
  eventCreated: boolean
}) {
  const { conferenceData, entryPoint } = props
  const isHangoutMeet = props.conferenceData.conference_solution!.key_type === 'hangoutsMeet'

  return (
    <Flex alignItems={'flex-start'} direction={'column'}>
      {props.eventCreated && (
        <Button
          mt="1"
          colorScheme="primary"
          fontSize="sm"
          onClick={() => {
            window.open(entryPoint.uri, '_blank')
          }}
        >
          {`Join ${conferenceData.conference_solution!.name}`}
        </Button>
      )}

      {isHangoutMeet ? (
        <Box mt="1">
          <Text fontSize="xs" color="gray.700">
            Url: <Link href={entryPoint.uri}>{entryPoint.uri}</Link>
          </Text>
          <Text fontSize="xs" color="gray.700">
            Code: {conferenceData.conference_id}
          </Text>
        </Box>
      ) : (
        <Box mt="1">
          <Box noOfLines={1}>
            <Link fontSize="xs" color="gray.700" textOverflow={'clip'} href={entryPoint.uri}>
              {entryPoint.uri}
            </Link>
          </Box>

          {entryPoint.meeting_code && (
            <Text fontSize="xs" color="gray.700">
              ID: {entryPoint.meeting_code}
            </Text>
          )}
          {entryPoint.password && (
            <Text fontSize="xs" color="gray.700">
              Password: {entryPoint.password}
            </Text>
          )}
        </Box>
      )}
    </Flex>
  )
}
function PhoneEntryPoint(props: { entryPoint: ConferenceEntryPoint }) {
  return (
    <Flex alignItems={'flex-start'} direction={'column'}>
      <Button
        pl="0"
        leftIcon={<FiPhone />}
        variant={'ghost'}
        colorScheme="primary"
        fontSize="sm"
        onClick={() => {
          window.open(props.entryPoint.uri, '_blank')
        }}
      >
        {`Join by Phone`}
      </Button>

      <Box>
        <Text fontSize="xs" color="gray.700">
          Phone: {props.entryPoint.label}
        </Text>
      </Box>
    </Flex>
  )
}

function MoreEntryPoint(props: { entryPoint: ConferenceEntryPoint }) {
  return (
    <Button
      leftIcon={<FiExternalLink />}
      variant={'link'}
      colorScheme="primary"
      fontSize="sm"
      onClick={() => {
        window.open(props.entryPoint.uri, '_blank')
      }}
      mt="1"
    >
      {`More Phone Numbers`}
    </Button>
  )
}

export default ConferenceList
