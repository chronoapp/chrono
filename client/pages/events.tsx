import React, { Component } from 'react';
import {
  getAuthToken,
  getEvents,
  getLabels,
  updateEvent,
  searchEvents } from '../util/Api';
import { CalendarEvent } from '../models/Event';
import { Label } from '../models/Label';
import Layout from '../components/Layout';

interface Props {}

interface State {
  dropdownEventId: number
  searchValue: string
  events: CalendarEvent[]
  labels: Label[]
}

class EventList extends Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
          dropdownEventId: 0,
          searchValue: "",
          events: [],
          labels: []
        }

        this.toggleAddLabelDropdown = this.toggleAddLabelDropdown.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this);
        this.onSearchSubmit = this.onSearchSubmit.bind(this);
    }

    async componentWillMount() {
      const authToken = getAuthToken();
      const events = await getEvents(authToken);
      const labels = await getLabels(authToken);

      this.setState({
        events,
        labels
      })
    }

    toggleAddLabelDropdown(eventId: number) {
      if (this.state.dropdownEventId == eventId) {
        this.setState({dropdownEventId: 0});
      } else {
        this.setState({dropdownEventId: eventId})
      }
    }

    addLabel(eventId: number, label: string) {
      const event = this.state.events.filter(e => e.id == eventId)[0];
      const newLabel = new Label(label, label)
      event.labels.push(newLabel);

      this.toggleAddLabelDropdown(eventId);
      const authToken = getAuthToken();

      updateEvent(authToken, event);
    }

    renderDropdown(eventId: number) {
      const { labels } = this.state;

      return (
        <div className={`dropdown ${eventId == this.state.dropdownEventId ? 'is-active' : ''}`}>
          <div onClick={_evt => this.toggleAddLabelDropdown(eventId)} className="dropdown-trigger">
            <a className="button is-text is-small">add label</a>
          </div>
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              {labels.map((label) => 
                <a onClick={_evt => this.addLabel(eventId, label.key)} key={label.key} className="dropdown-item">
                  {label.title}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    onSearchChange(event) {
      this.setState({searchValue: event.target.value});
    }

    onSearchSubmit() {
      const { searchValue } = this.state;
      searchEvents(getAuthToken(), searchValue).then((events) => {
        this.setState({events})
      })
    }

    renderTable() {
      const { events } = this.state;
      if (events.length == 0) {
        return <div/>
      }

      return (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {
              events.map(event => {
                return (
                  <tr key={`event-${event.id}`}>
                      <td>{event.dayDisplay}</td>
                      <td>{event.title}</td>
                      <td>
                      {event.labels.map(label => 
                          <span key={label.key} className="tag">{label.title}</span>
                      )}
                      {this.renderDropdown(event.id)}
                      </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      );
    }

    render() {
      return (
        <Layout>
            <section>
              <div className="container">
                  <h1 className="title">
                    Event Labels
                  </h1>
                  <p className="subtitle">
                    Label my events.
                  </p>
              </div><br/>
            </section>

            <section className="columns">
              <div className="column is-8 is-offset-2">
                <div className="field has-addons">
                  <div className="control is-expanded">
                    <input
                      className="input"
                      type="text"
                      value={this.state.searchValue}
                      onChange={this.onSearchChange}
                      placeholder="Find an event"/>
                  </div>
                  <div className="control">
                    <a
                      className="button is-info"
                      onClick={this.onSearchSubmit}>
                      Search
                    </a>
                  </div>
                </div>

                { this.renderTable() }
              </div>
            </section>
        </Layout>
      );
    }
}

export default EventList
