import { FiChevronDown, FiX, FiExternalLink, FiPhone } from 'react-icons/fi'

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
  type: ConferenceKeyType
  logo: string
  conferenceData: ConferenceData | null
}

interface IProps extends BoxProps {
  originalConferenceData: ConferenceData | null
  conferenceData: ConferenceData | null
  readonly: boolean
  onSelectConference?: (conferenceData: ConferenceData | null) => void
}

const defaultConferenceItem: ConferenceItem = {
  title: 'Google meet',
  type: 'hangoutsMeet',
  logo: GoogleMeetLogo,
  conferenceData: null,
}

function getConferenceList(conferenceData: ConferenceData | null): ConferenceItem[] {
  const ConferenceList: ConferenceItem[] = []

  if (
    !conferenceData ||
    conferenceData.conference_solution?.key_type === 'addOn' ||
    conferenceData.create_request?.status === 'pending'
  ) {
    ConferenceList.push(defaultConferenceItem)
  }

  if (conferenceData && conferenceData.conference_solution) {
    ConferenceList.push({
      title: conferenceData.conference_solution.name,
      type: conferenceData.conference_solution.key_type,
      logo: conferenceData.conference_solution.icon_uri,
      conferenceData: conferenceData,
    })
  }

  return ConferenceList
}

function getSelectedConference(
  conferenceList: ConferenceItem[],
  conferenceData: ConferenceData | null
): ConferenceItem | null {
  if (conferenceData?.create_request?.conference_solution_key_type === defaultConferenceItem.type) {
    return conferenceList.find((conference) => conference.type === defaultConferenceItem.type)!
  } else {
    return conferenceList.find(
      (conference) =>
        conference.conferenceData &&
        conference.conferenceData.conference_id === conferenceData?.conference_id
    )!
  }
}

function ConferenceList(props: IProps) {
  const { originalConferenceData, conferenceData, readonly, onSelectConference, ...boxProps } =
    props

  const conferenceList = getConferenceList(originalConferenceData)
  const selectedConference = getSelectedConference(conferenceList, conferenceData)

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
              <MenuButton as={Button} rightIcon={<FiChevronDown />}>
                add conferencing
              </MenuButton>
            )}

            <MenuList>
              {conferenceList.map((conference, idx) => (
                <MenuItem
                  fontSize="sm"
                  key={idx}
                  onClick={() => {
                    if (conference.conferenceData) {
                      onSelectConference!(conference.conferenceData)
                    } else if (conference.type === 'hangoutsMeet') {
                      onSelectConference!(ConferenceData.newHangoutsMeet())
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

      {selectedConference && <ConferenceDetails selectedVideoConference={selectedConference} />}
    </Flex>
  )
}

function ConferenceDetails(props: { selectedVideoConference: ConferenceItem }) {
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
    <Box mt="1">
      {entryPoints.map((entryPoint, idx) => (
        <Flex key={idx} mt="2">
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
      return <VideoEntryPoint conferenceData={conferenceData} entryPoint={entryPoint} />
    }
  }
}

function VideoEntryPoint(props: {
  conferenceData: ConferenceData
  entryPoint: ConferenceEntryPoint
}) {
  const { conferenceData, entryPoint } = props
  const isHangoutMeet = props.conferenceData.conference_solution!.key_type === 'hangoutsMeet'

  return (
    <Flex alignItems={'flex-start'} direction={'column'}>
      <Button
        colorScheme="primary"
        fontSize="sm"
        onClick={() => {
          window.open(entryPoint.uri, '_blank')
        }}
      >
        {`Join ${conferenceData.conference_solution!.name}`}
      </Button>

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
          {entryPoint.meeting_code && (
            <Text fontSize="xs" color="gray.700">
              ID: {entryPoint.meeting_code}
            </Text>
          )}
          {entryPoint.password && (
            <Text fontSize="xs" color="gray.700">
              Password:
              {entryPoint.password}
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
