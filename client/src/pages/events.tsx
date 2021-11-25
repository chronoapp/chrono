import React from 'react'
import {
  Container,
  Button,
  Flex,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Box,
  Table,
  Thead,
  Tr,
  Th,
  Td,
  Tbody,
  Tag,
  TagLabel,
  TagCloseButton,
  Menu,
  MenuButton,
  MenuList,
} from '@chakra-ui/react'
import { FiSearch } from 'react-icons/fi'
import tinycolor from 'tinycolor2'

import { format, getDurationDisplay } from '@/util/localizer'
import {
  getEvents,
  getLabels,
  updateEvent,
  searchEvents,
  getLabelRules,
  putLabelRule,
  auth,
} from '@/util/Api'
import Event from '@/models/Event'
import { Label } from '@/models/Label'
import { LabelRule } from '@/models/LabelRule'
import Layout from '@/components/Layout'
import LabelTree from '@/components/LabelTree'
import { LabelContext } from '@/contexts/LabelsContext'
interface Props {
  authToken: string
}

/**
 * Data needed to apply a label to a calendar event.
 * Either apply it to the one event, or all events.
 */
interface LabelRuleState {
  addLabelRuleModalActive: boolean
  numEvents: number
  event: Event
  label: Label
  applyAll: boolean
}

interface State {
  events: Event[]
  labels: Label[]

  // Label Rule
  addLabelRuleModalActive: boolean
  labelRuleState: LabelRuleState | null
  isRefreshing: boolean
}

function LabelTagSolid(props: {
  event: Event
  label: Label
  onRemoveLabel: (eventId: string, labelId: number) => void
}) {
  const labelStyle = {
    backgroundColor: props.label.color_hex,
    marginRight: '0.25em',
    color: tinycolor(props.label.color_hex).getLuminance() < 0.5 ? 'white' : '#4a4a4a',
  }

  return (
    <Tag size={'md'} borderRadius="sm" variant="solid" style={labelStyle}>
      <TagLabel>{props.label.title}</TagLabel>
      <TagCloseButton onClick={() => props.onRemoveLabel(props.event.id, props.label.id)} />
    </Tag>
  )
}

function SearchBar(props: { onRefreshEvents: (s: string) => void }) {
  const [searchValue, setSearchValue] = React.useState('')

  return (
    <Flex w="100%" mt="2">
      <Input
        borderRadius="0"
        type="text"
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value)
        }}
        onKeyPress={(event) => {
          if (event.key == 'Enter') {
            props.onRefreshEvents(searchValue)
          }
        }}
        placeholder="Find an event"
      />
      <Button
        fontWeight="normal"
        borderRadius="0"
        onClick={() => props.onRefreshEvents(searchValue)}
        leftIcon={<FiSearch />}
      >
        Search
      </Button>
    </Flex>
  )
}

class EventList extends React.Component<Props, State> {
  static contextType = LabelContext
  context!: React.ContextType<typeof LabelContext>

  constructor(props: Props) {
    super(props)
    this.state = {
      events: [],
      labels: [],
      addLabelRuleModalActive: false,
      labelRuleState: null,
      isRefreshing: false,
    }

    this.refreshEvents = this.refreshEvents.bind(this)
    this.applyLabelToEvent = this.applyLabelToEvent.bind(this)
    this.removeLabel = this.removeLabel.bind(this)
  }

  static async getInitialProps(ctx) {
    const authToken = auth(ctx)
    return { authToken }
  }

  async componentDidMount() {
    const authToken = this.props.authToken
    const events = await getEvents(authToken)
    const labels = await getLabels(authToken)
    this.context.dispatch({ type: 'INIT', payload: labels })

    this.setState({
      events,
      labels,
    })
  }

  async addLabel(eventId: string, labelId: number) {
    const event = this.state.events.find((e) => e.id == eventId)
    if (!event) return
    if (event.labels.find((l) => l.id === labelId)) {
      return
    }

    const { authToken } = this.props
    const label = this.state.labels.find((l) => l.id == labelId)
    if (!label) {
      return
    }

    // If labelRule doesn't exist, add to add to all labels?
    // TODO: rethink the UI or make it more performant
    const labelRules = await getLabelRules(event.title_short, label.id, authToken)
    const labelRuleState = {
      event: event,
      label: label,
      addLabelRuleModalActive: false,
      numEvents: 1,
      applyAll: false,
    }

    if (labelRules.length == 0) {
      const eventsWithTitle = await getEvents(authToken, event.title_short)
      labelRuleState.addLabelRuleModalActive = true
      labelRuleState.numEvents = eventsWithTitle.length
      this.setState({ labelRuleState })
    } else {
      this.setState({ labelRuleState })
      this.applyLabelToEvent()
    }
  }

  async applyLabelToEvent() {
    const { labelRuleState } = this.state
    if (!labelRuleState) return

    if (labelRuleState.applyAll) {
      const labelRule = new LabelRule(labelRuleState.event.title_short, labelRuleState.label.id)
      putLabelRule(labelRule, this.props.authToken).then((_labelRule) => {
        // this.refreshEvents()
      })
    } else {
      labelRuleState.event.labels.push(labelRuleState.label)
      updateEvent(this.props.authToken, labelRuleState.event)
    }

    this.setState({ labelRuleState: null })
  }

  removeLabel(eventId: string, labelId: number) {
    const event = this.state.events.find((e) => e.id == eventId)
    if (event) {
      const remainingLabels = event.labels.filter((l) => l.id !== labelId)
      event.labels = remainingLabels
      updateEvent(this.props.authToken, event)
      this.setState({ events: this.state.events })
    }
  }

  async refreshEvents(searchValue?: string) {
    const authToken = this.props.authToken

    if (searchValue) {
      searchEvents(authToken, searchValue).then((events) => {
        this.setState({ events })
      })
    } else {
      getEvents(authToken).then((events) => {
        this.setState({ events })
      })
    }
  }

  renderAddLabelRuleModal() {
    const { labelRuleState } = this.state
    if (!labelRuleState) {
      return null
    }

    return (
      <Modal
        isOpen={labelRuleState.addLabelRuleModalActive}
        onClose={() => {
          labelRuleState.addLabelRuleModalActive = false
          this.setState({ labelRuleState })
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add tag to event</ModalHeader>

          <ModalBody>
            <div className="control radio-list">
              <label className="radio">
                <input
                  type="radio"
                  name="foobar"
                  checked={!labelRuleState.applyAll}
                  onChange={() => {
                    labelRuleState.applyAll = !labelRuleState.applyAll
                    this.setState({ labelRuleState })
                  }}
                />
                <span>Apply once</span>
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="foobar"
                  checked={labelRuleState.applyAll}
                  onChange={() => {
                    labelRuleState.applyAll = !labelRuleState.applyAll
                    this.setState({ labelRuleState })
                  }}
                />
                <span>
                  Apply to all <b>{labelRuleState.numEvents}</b> events with title{' '}
                  <b>{labelRuleState.event.title}</b>.
                </span>
              </label>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              variant={'ghost'}
              mr={3}
              onClick={() => {
                labelRuleState.addLabelRuleModalActive = false
                this.setState({ labelRuleState })
              }}
            >
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={this.applyLabelToEvent}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  renderTable() {
    const { events } = this.state

    return (
      events.length > 0 && (
        <Table variant="simple" textAlign="left">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Duration</Th>
              <Th>Event</Th>
              <Th>Tag</Th>
            </Tr>
          </Thead>
          <Tbody>
            {events.map((_, idx, arr) => {
              // Reverse order without copy.
              const event = arr[arr.length - 1 - idx]

              return (
                <Tr key={`event-${event.id}`}>
                  <Td>{format(event.start, 'MMM DD')}</Td>
                  <Td>{getDurationDisplay(event.start, event.end)}</Td>
                  <Td>{Event.getDefaultTitle(event.title)}</Td>
                  <Td>
                    <Box display="flex" alignItems="center">
                      {event.labels.map((label) => (
                        <LabelTagSolid
                          key={`${event.id}-${label.id}`}
                          event={event}
                          label={label}
                          onRemoveLabel={this.removeLabel}
                        />
                      ))}

                      <Menu isLazy>
                        {({ onClose }) => (
                          <>
                            <MenuButton
                              ml="2"
                              mr="2"
                              borderRadius="xs"
                              size="sm"
                              fontWeight="normal"
                              fontSize="sm"
                              as={Button}
                              variant="link"
                            >
                              Add tag
                            </MenuButton>

                            <MenuList pl="1">
                              <LabelTree
                                allowEdit={false}
                                onSelect={(label) => {
                                  this.addLabel(event.id, label.id)
                                  onClose()
                                }}
                              />
                            </MenuList>
                          </>
                        )}
                      </Menu>
                    </Box>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )
    )
  }

  render() {
    return (
      <Layout>
        <Box w="100%" overflowY="scroll">
          <Container maxW="5xl" centerContent>
            <SearchBar onRefreshEvents={(search) => this.refreshEvents(search)} />
            {this.renderAddLabelRuleModal()}
            {this.renderTable()}
          </Container>
        </Box>
      </Layout>
    )
  }
}

export default EventList
