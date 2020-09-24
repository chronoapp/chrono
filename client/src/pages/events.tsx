import React, { Component } from 'react'
import tinycolor from 'tinycolor2'

import { format, getDurationDisplay } from '../util/localizer'
import {
  getEvents,
  getLabels,
  updateEvent,
  searchEvents,
  getLabelRules,
  putLabelRule,
  syncCalendar,
  auth,
} from '../util/Api'
import Event from '../models/Event'
import { Label } from '../models/Label'
import { LabelRule } from '../models/LabelRule'
import Layout from '../components/Layout'

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
  dropdownEventId: number
  searchValue: string
  events: Event[]
  labels: Label[]

  // Label Rule
  addLabelRuleModalActive: boolean
  labelRuleState: LabelRuleState | null
  isRefreshing: boolean
}

class EventList extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      dropdownEventId: 0,
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
    this.refreshCalendar = this.refreshCalendar.bind(this)
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

  toggleAddLabelDropdown(eventId: number) {
    if (this.state.dropdownEventId == eventId) {
      this.setState({ dropdownEventId: 0 })
    } else {
      this.setState({ dropdownEventId: eventId })
    }
  }

  async addLabel(eventId: number, labelId: number) {
    const event = this.state.events.find((e) => e.id == eventId)
    if (!event) return
    if (event.labels.find((l) => l.id === labelId)) {
      this.toggleAddLabelDropdown(eventId)
      return
    }

    const { authToken } = this.props
    const label = this.state.labels.find((l) => l.id == labelId)
    if (!label) return

    // If labelRule doesn't exist, add to add to all labels?
    // TODO: rethink the UI or make it more performant
    const labelRules = await getLabelRules(event.title, authToken)
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

  async refreshCalendar() {
    this.setState({ isRefreshing: true })
    await syncCalendar(this.props.authToken)
    await this.refreshEvents()
    this.setState({ isRefreshing: false })
  }

  removeLabel(eventId: number, labelId: number) {
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

  renderDropdown(eventId: number) {
    const { labels } = this.state

    return (
      <div className={`dropdown ${eventId == this.state.dropdownEventId ? 'is-active' : ''}`}>
        <div onClick={(_evt) => this.toggleAddLabelDropdown(eventId)} className="dropdown-trigger">
          <a className="button is-text is-small">add label</a>
        </div>
        {eventId === this.state.dropdownEventId ? (
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              {labels.map((label) => (
                <a
                  onClick={(_evt) => this.addLabel(eventId, label.id)}
                  key={label.id}
                  className="dropdown-item "
                >
                  <div
                    style={{
                      backgroundColor: label.color_hex,
                      display: 'inline-block',
                      verticalAlign: 'middle',
                    }}
                    className="event-label"
                  ></div>
                  <span style={{ marginLeft: '.5em' }}>{label.title}</span>
                </a>
              ))}
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
      <div className={`modal ${labelRuleState.addLabelRuleModalActive ? 'is-active' : null}`}>
        <div className="modal-background"></div>
        <div className="modal-card">
          <header className="modal-card-head">
            <p className="modal-card-title">Add label to event</p>
          </header>
          <section className="modal-card-body">
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
          </section>
          <footer className="modal-card-foot">
            <button className="button is-link" onClick={this.applyLabelToEvent}>
              Apply
            </button>
            <button
              className="button"
              onClick={() => {
                labelRuleState.addLabelRuleModalActive = false
                this.setState({ labelRuleState })
              }}
            >
              Cancel
            </button>
          </footer>
        </div>
      </div>
    )
  }

  renderTable() {
    const { events } = this.state
    if (events.length == 0) {
      return <div />
    }

    return (
      <table className="table has-text-left">
        <thead>
          <tr>
            <th>Date</th>
            <th>Duration</th>
            <th>Event</th>
            <th>Label</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            return (
              <tr key={`event-${event.id}`}>
                <td>{format(event.start, 'MMMM DD')}</td>
                <td>{getDurationDisplay(event.start, event.end)}</td>
                <td>{event.title}</td>
                <td>
                  {event.labels.map((label) => {
                    const labelStyle = {
                      backgroundColor: label.color_hex,
                      marginRight: 5,
                      color: tinycolor(label.color_hex).getLuminance() < 0.5 ? 'white' : '#4a4a4a',
                    }

                    return (
                      <span
                        onClick={() => this.removeLabel(event.id, label.id)}
                        key={`${event.id}-${label.id}`}
                        style={labelStyle}
                        className="tag"
                      >
                        {label.title}
                      </span>
                    )
                  })}
                  {this.renderDropdown(event.id)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  renderSearchBar() {
    return (
      <div className="field has-addons mt-3">
        <div className="control is-expanded">
          <input
            className="input"
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
        </div>
        <div className="control">
          <a className="button is-info" onClick={this.refreshEvents}>
            Search
          </a>
        </div>
        <button
          style={{ marginLeft: '1em' }}
          onClick={this.refreshCalendar}
          className={`button is-small is-link ${this.state.isRefreshing ? 'is-loading' : null}`}
        >
          Refresh
        </button>
      </div>
    )
  }

  render() {
    return (
      <Layout>
        <section>
          {this.renderSearchBar()}
          {this.renderAddLabelRuleModal()}
          {this.renderTable()}
        </section>
      </Layout>
    )
  }
}

export default EventList
