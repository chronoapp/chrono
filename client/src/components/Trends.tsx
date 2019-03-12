import React, { Component } from 'react';
import { Line } from 'react-chartjs-2';
import { getStats } from '../util/Api';

interface Props {}
interface State {
    dropdownActive: boolean,
    chartData: any
}

export class Trends extends Component<Props,State> {

    constructor(props: Props) {
        super(props);
        this.state = {
          dropdownActive: false,
          chartData: {
            labels: [],
            values: [],
          }
        }
        this.toggleDropdown = this.toggleDropdown.bind(this);      
    }

    toggleDropdown() {
        const dropdownActive = !this.state.dropdownActive;
        this.setState({dropdownActive: dropdownActive});
    }

    componentWillMount() {
      getStats().then(resp => {
        const chartData = {
          labels: resp.labels,
          values: resp.values,
        }
        this.setState({chartData: chartData});
      })
    }

    renderDropdown() {
        return (
          <div className={`dropdown is-hoverable ${this.state.dropdownActive ? 'is-active': ''}`}>
            <div onClick={this.toggleDropdown} className="dropdown-trigger">
              <button className="button" aria-haspopup="true" aria-controls="dropdown-menu">
                <span>Last 7 days</span>
                <span className="icon is-small">
                  <i className="fa fa-angle-down" aria-hidden="true"></i>
                </span>
              </button>
            </div>
            <div className="dropdown-menu" id="dropdown-menu" role="menu">
              <div className="dropdown-content">
                <a className="dropdown-item">
                  7 days
                </a>
                <a className="dropdown-item">
                  14 days
                </a>
              </div>
            </div>
          </div>
        );
      }

    render() {
        const options = {
            title: {
              text: "Work over Time"
            },
            layout: {
              padding: {
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0
              }
            },
            scales: {
              yAxes: [{
                  display: true,
                  ticks: {
                      suggestedMin: 0,    // minimum will be 0, unless there is a lower value.
                  },
                  scaleLabel: {
                    display: true,
                    labelString: 'time spent'
                  }
              }]
            },
            legend: {
              display: false
            }
          }

        const data = {
            labels: this.state.chartData.labels,
            datasets: [{
                label: "Time spent",
                borderColor: '#165cad',
                fill: false,
                data: this.state.chartData.values,
            }]
        }

        return (
            <div className="App">
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
              </section>

              <section className="section">
                <div className="container">
                  <div className="columns">
                    <div className="card column is-8">
                      <div className="card-header">
                        <p className="card-header-title">Time spent: &nbsp;<span className="has-text-grey">Work</span></p>
                        <div className="card-header-icon" aria-label="more options">
                        <span className="icon">
                            <i className="fa fa-angle-down" aria-hidden="true"></i>
                        </span>
                        </div>
                      </div>
                      <div className="card-content">
                        <Line data={data} options={options}/>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
        );
    }
}
