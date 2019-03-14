import React, { Component } from 'react';
import { getEvents, getLabels, addLabel } from '../util/Api';
import { CalendarEvent, EventLabel } from '../models/Event';
import Layout from '../components/Layout';

interface Props {
    events: CalendarEvent[]
    labels: string[]
}

interface State {
  dropdownEventId: number
}

class EventList extends Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
          dropdownEventId: 0
        }

        this.toggleAddLabelDropdown = this.toggleAddLabelDropdown.bind(this);
    }

    static async getInitialProps () {
        const events = await getEvents();
        const labels = await getLabels();

        return {
            events,
            labels,
        }
    }

    toggleAddLabelDropdown(eventId: number) {
      if (this.state.dropdownEventId == eventId) {
        this.setState({dropdownEventId: 0});
      } else {
        this.setState({dropdownEventId: eventId})
      }
    }

    addLabel(eventId: number, label: string) {
      const { events } = this.props;
      const event = events.filter(e => e.id == eventId)[0];
      const newLabel = new EventLabel(label, label)
      event.labels.push(newLabel);

      this.toggleAddLabelDropdown(eventId);
      addLabel(eventId, newLabel);
    }

    renderDropdown(eventId: number) {
      const { labels } = this.props;

      return (
        <div className={`dropdown ${eventId == this.state.dropdownEventId ? 'is-active' : ''}`}>
          <div onClick={_evt => this.toggleAddLabelDropdown(eventId)} className="dropdown-trigger">
              <span className="icon button" aria-haspopup="true" aria-controls="dropdown-menu">
                <i className="fa fa-plus-circle" aria-hidden="true"></i>
              </span>
          </div>
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              {labels.map(label => 
                <a onClick={_evt => this.addLabel(eventId, label)} key={label} className="dropdown-item">
                  {label}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    render() {
      const { events } = this.props;
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
            </div>
            </section>

            <section className="columns">
            <table className="table column is-8 is-offset-2">
                <thead>
                <tr>
                    <th>Event</th>
                    <th>Label</th>
                </tr>
                </thead>
                <tbody>
                {
                    events.map(event => {
                        return (
                        <tr key={`event-${event.id}`}>
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
            </section>
        </Layout>
      );
    }
}

export default EventList
