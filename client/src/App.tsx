import React, { Component } from 'react';
import './App.css';

import 'bulma/css/bulma.css'
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Label, LabelList, LineChart, Line} from 'recharts';

interface State {
  dropdownActive: boolean
}

class App extends Component<{}, State> {
  options: any

  constructor(props: any) {
    super(props);
    this.state = {
      dropdownActive: false
    }

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
      <div className={`dropdown is-hoverable ${this.state.dropdownActive ? 'is-active': ''}`}>
        <div onClick={this.toggleDropdown} className="dropdown-trigger">
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

  renderLineChart() {
    const data = [
      {name: 'Page A', uv: 4000, pv: 2400, amt: 2400},
      {name: 'Page B', uv: 3000, pv: 1398, amt: 2210},
      {name: 'Page C', uv: 2000, pv: 9800, amt: 2290},
      {name: 'Page D', uv: 2780, pv: 3908, amt: 2000},
      {name: 'Page E', uv: 1890, pv: 4800, amt: 2181},
      {name: 'Page F', uv: 2390, pv: 3800, amt: 2500},
      {name: 'Page G', uv: 3490, pv: 4300, amt: 2100},
    ];
    return (
      <LineChart width={600} height={300} data={data}
      margin={{top: 5, right: 30, left: 20, bottom: 5}}>
        <XAxis dataKey="name"/>
        <YAxis/>
        <CartesianGrid strokeDasharray="3 3"/>
        <Tooltip/>
        <Legend />
        <Line type="monotone" dataKey="pv" stroke="#8884d8" activeDot={{r: 8}}/>
        <Line type="monotone" dataKey="uv" stroke="#82ca9d" />
      </LineChart>
    );
  }

  renderPanel() {
    return (
      <nav className="navbar" role="navigation" aria-label="main navigation">
        <div className="navbar-brand">
          <a className="navbar-item" href="#">
            <span className="primary">timecouncil</span>
          </a>

          <a role="button" className="navbar-burger burger" aria-label="menu" aria-expanded="false" data-target="navbarBasicExample">
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </a>
        </div>

        <div id="navbarBasicExample" className="navbar-menu">
          <div className="navbar-start">
            <a className="navbar-item">
              Home
            </a>
            <a className="navbar-item">
              Documentation
            </a>
          </div>

          <div className="navbar-end">
            <div className="navbar-item">
              <div className="buttons">
                <a className="button is-primary">
                  <strong>Sign up</strong>
                </a>
                <a className="button is-light">
                  Log in
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  render() {

    const data = [
      {name: 'Eating', hours: 5, fill: '#106596'},
      {name: 'Sleeping', hours: 15, fill: '#1d7c91'},
      {name: 'Working', hours: 22, fill: '#1d7c91'},
      {name: 'Browsing', hours: 11 },
      {name: 'Meetups', hours: 5 },
    ];

    return (
      <div className="App">
        {this.renderPanel()}

        <section>
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

          <div className="container">
            <div className="columns is-multiline">
              <div className="column is-5">
              <BarChart layout={'vertical'} width={600} height={350} data={data}
                  margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis type="number"/>
                <YAxis dataKey="name" type="category"/>
                <Tooltip/>
                <Legend />
                <Bar dataKey="hours" />
              </BarChart>
              </div>
              <div className="column is-5">
              <PieChart width={400} height={350}>
                <Pie data={data} dataKey="hours" nameKey="name" label={this.renderCustomLabel} outerRadius={80}>
                </Pie>
                <Tooltip/>
              </PieChart>
              </div>
              <div className="card column is-5">
                <div className="">
                  {this.renderLineChart()}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="columns">

          </div>
        </section>
      </div>
    );
  }
}

export default App;
