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
} from '@chakra-ui/react'
import { FiSearch } from 'react-icons/fi'
import tinycolor from 'tinycolor2'

import { format, getDurationDisplay } from '../util/localizer'
import {
  getEvents,
  getLabels,
  updateEvent,
  searchEvents,
  getLabelRules,
  putLabelRule,
  auth,
} from '../util/Api'
import Event, { UNSAVED_EVENT_ID } from '../models/Event'
import { Label } from '../models/Label'
import { LabelRule } from '../models/LabelRule'
import Layout from '../components/Layout'
import LabelTree from '../components/LabelTree'

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
  dropdownEventId: string
  searchValue: string
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

class EventList extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      dropdownEventId: UNSAVED_EVENT_ID,
      searchValue: '',
      events: [],
      labels: [],
      addLabelRuleModalActive: false,
      labelRuleState: null,
      isRefreshing: false,
    }

    this.toggleAddLabelDropdown = this.toggleAddLabelDropdown.bind(this)
    this.onSearchChange = this.onSearchChange.bind(this)
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

    this.setState({
      events,
      labels,
    })
  }

  toggleAddLabelDropdown(eventId: string) {
    if (this.state.dropdownEventId == eventId) {
      this.setState({ dropdownEventId: UNSAVED_EVENT_ID })
    } else {
      this.setState({ dropdownEventId: eventId })
    }
  }

  async addLabel(eventId: string, labelId: number) {
    const event = this.state.events.find((e) => e.id == eventId)
    if (!event) return
    if (event.labels.find((l) => l.id === labelId)) {
      this.toggleAddLabelDropdown(eventId)
      return
    }

    const { authToken } = this.props
    const label = this.state.labels.find((l) => l.id == labelId)
    if (!label) {
      return
    }

    // If labelRule doesn't exist, add to add to all labels?
    // TODO: rethink the UI or make it more performant
    const labelRules = await getLabelRules(event.title, label.id, authToken)
    const labelRuleState = {
      event: event,
      label: label,
      addLabelRuleModalActive: false,
      numEvents: 1,
      applyAll: false,
    }

    if (labelRules.length == 0) {
      const eventsWithTitle = await getEvents(authToken, event.title)
      labelRuleState.addLabelRuleModalActive = true
      labelRuleState.numEvents = eventsWithTitle.length
      this.setState({ labelRuleState })
    } else {
      this.setState({ labelRuleState })
      this.applyLabelToEvent()
    }

    this.toggleAddLabelDropdown(eventId)
  }

  async applyLabelToEvent() {
    const { labelRuleState } = this.state
    if (!labelRuleState) return

    if (labelRuleState.applyAll) {
      const labelRule = new LabelRule(labelRuleState.event.title, labelRuleState.label.id)
      putLabelRule(labelRule, this.props.authToken).then((_labelRule) => {
        this.refreshEvents()
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

  onSearchChange(event) {
    this.setState({ searchValue: event.target.value })
  }

  async refreshEvents() {
    const { searchValue } = this.state
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

  renderDropdown(eventId: string) {
    return (
      <div className={`dropdown ${eventId == this.state.dropdownEventId ? 'is-active' : ''}`}>
        <div onClick={(_evt) => this.toggleAddLabelDropdown(eventId)} className="dropdown-trigger">
          <a className="button is-text is-small">add tag</a>
        </div>
        {eventId === this.state.dropdownEventId ? (
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              <LabelTree
                allowEdit={false}
                onSelect={(label) => {
                  this.addLabel(eventId, label.id)
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    )
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
                  <Td>{Event.getDefaultTitle(event)}</Td>
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
                      {this.renderDropdown(event.id)}
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

  renderSearchBar() {
    return (
      this.state.events.length > 0 && (
        <Flex w="100%" mt="2">
          <Input
            borderRadius="0"
            type="text"
            value={this.state.searchValue}
            onChange={this.onSearchChange}
            onKeyPress={(event) => {
              if (event.key == 'Enter') {
                this.refreshEvents()
              }
            }}
            placeholder="Find an event"
          />
          <Button
            fontWeight="normal"
            borderRadius="0"
            onClick={this.refreshEvents}
            leftIcon={<FiSearch />}
          >
            Search
          </Button>
        </Flex>
      )
    )
  }

  render() {
    return (
      <Layout>
        <Box w="100%" overflowY="scroll">
          <Container maxW="4xl" centerContent>
            {this.renderSearchBar()}
            {this.renderAddLabelRuleModal()}
            {this.renderTable()}
          </Container>
        </Box>
      </Layout>
    )
  }
}

export default EventList
