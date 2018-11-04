import React, { Component } from 'react';
import './App.css';
import 'bulma/css/bulma.css'
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Label, LabelList} from 'recharts';

interface State {
  dropdownActive: boolean
}

class App extends Component<{}, State> {
  data: any
  options: any

  constructor(props: any) {
    super(props);
    this.state = {
      dropdownActive: false
    }

    this.data = [
      {name: 'Eating', hours: 5, fill: '#106596'},
      {name: 'Sleeping', hours: 15, fill: '#1d7c91'},
      {name: 'Working', hours: 22, fill: '#1d7c91'},
      {name: 'Browsing', hours: 11 },
      {name: 'Meetups', hours: 5 },
    ];

    this.toggleDropdown = this.toggleDropdown.bind(this);
  }

  renderCustomLabel(data: any) {;
    return data.name;
  }

  toggleDropdown() {
    const dropdownActive = !this.state.dropdownActive;
    this.setState({dropdownActive: dropdownActive});
  }

  renderDropdown() {
    return (
      <div onClick={this.toggleDropdown}
          className={`dropdown is-clearfix ${this.state.dropdownActive ? 'is-active': ''}`}>
        <div className="dropdown-trigger">
          <button className="button" aria-haspopup="true" aria-controls="dropdown-menu">
            <span>Last 7 days</span>
            <span className="icon is-small">
              <i className="fas fa-angle-down" aria-hidden="true"></i>
            </span>
          </button>
        </div>
        <div className="dropdown-menu" id="dropdown-menu" role="menu">
          <div className="dropdown-content">
            <a href="#" className="dropdown-item">
              Dropdown item
            </a>
            <a className="dropdown-item">
              Other dropdown item
            </a>
            <a href="#" className="dropdown-item is-active">
              Active dropdown item
            </a>
            <a href="#" className="dropdown-item">
              Other dropdown item
            </a>
            <hr className="dropdown-divider"/>
            <a href="#" className="dropdown-item">
              With a divider
            </a>
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="App">
        <section className="section">
          <div className="container">
            <h1 className="title">
              Time Trends
            </h1>
            <p className="subtitle">
              Activities over time.
            </p>
            <div className="notification columns">
                { this.renderDropdown() }
            </div>
          </div>
        </section>

        <section>
            <div className="container">
              <BarChart layout={'vertical'} width={600} height={300} data={this.data}
                  margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis type="number"/>
                <YAxis dataKey="name" type="category"/>
                <Tooltip/>
                <Legend />
                <Bar dataKey="hours" />
              </BarChart>

              <PieChart width={400} height={400}>
                <Pie data={this.data} dataKey="hours" nameKey="name" label={this.renderCustomLabel} outerRadius={80}>
                </Pie>
                <Tooltip/>
              </PieChart>
            </div>
          </section>
      </div>
    );
  }
}

export default App;
