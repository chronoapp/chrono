import React, { Component } from 'react';
import { getEvents, getLabels } from '../util/Api';
import { CalendarEvent } from '../models/Event';

interface Props {}
interface State {
  events: CalendarEvent[]
  labels: string[]
  dropdownEventId: number
}

export class EventList extends Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
          events: [],
          labels: [],
          dropdownEventId: 0
        }

        this.toggleAddLabelDropdown = this.toggleAddLabelDropdown.bind(this);
    }

    componentWillMount() {
      getEvents().then(events => {
        this.setState({events});
      })
      getLabels().then(labels => {
        this.setState({labels})
      })
    }

    toggleAddLabelDropdown(eventId: number) {
      return (_evt: any) => {
        if (this.state.dropdownEventId == eventId) {
          this.setState({dropdownEventId: 0});
        } else {
          this.setState({dropdownEventId: eventId})
        }
      }
    }

    renderDropdown(eventId: number) {
      return (
        <div className={`dropdown ${eventId == this.state.dropdownEventId ? 'is-active' : ''}`}>
          <div onClick={this.toggleAddLabelDropdown(eventId)} className="dropdown-trigger">
              <span className="icon button" aria-haspopup="true" aria-controls="dropdown-menu">
                <i className="fa fa-plus-circle" aria-hidden="true"></i>
              </span>
          </div>
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              {this.state.labels.map(label => 
                <a key={label} href="#" className="dropdown-item">
                  {label}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    render() {
      return (
        <div>
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
                this.state.events.map(event => {
                    return (
                      <tr key={`event-${event.id}`}>
                        <th>{event.title}</th>
                        <td>
                          {event.labels.map(label => 
                              <span className="tag">label</span>
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
        </div>
      );
    }
}
