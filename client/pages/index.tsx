import * as React from 'react';
import Layout from '../components/Layout';
import LabelPanel from '../components/LabelPanel';
import { Bar } from 'react-chartjs-2';
import { getTrends, getAuthToken, getLabels, putLabel } from '../util/Api';
import { Label } from '../models/Label';

interface Props {
    authToken: string,
}

interface State {
    timespanDropdownActive: boolean
    labelDropdownActive: boolean
    labels: Label[],
    selectedLabel: Label | null,
    chartData: any,
}

/**
 * List of trends.
 */
class Home extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
          timespanDropdownActive: false,
          labelDropdownActive: false,
          labels: [],
          selectedLabel: null,
          chartData: {},
        }
        this.toggleDropdown = this.toggleDropdown.bind(this);      
    }

    static async getInitialProps({ req }) {
        const authToken = getAuthToken(req);
        return { authToken }
    }

    async componentWillMount() {
      const authToken = getAuthToken();
      const labels = await getLabels(authToken);
      const trends = await getTrends(authToken);
      const selectedLabel = labels.length > 0 ? labels[0] : null;

      const chartData = {
          labels: trends.labels,
          values: trends.values,
      }

      this.setState({
        labels,
        chartData,
        selectedLabel
      });
    }

    toggleDropdown() {
        const timespanDropdownActive = !this.state.timespanDropdownActive;
        this.setState({timespanDropdownActive: timespanDropdownActive});
    }

    renderDropdown() {
      return (
        <div className={`dropdown is-hoverable ${this.state.timespanDropdownActive ? 'is-active': ''}`}>
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
        const { authToken } = this.props;
        const { chartData } = this.state;

        if (!authToken) {
            return <Layout loggedIn={false} children={null}/>
        }

        const { labels } = this.state;

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
                    labelString: 'Hours per 7 days'
                  }
              }]
            },
            legend: {
              display: false
            }
          }

        const workLabel = labels.find(label => label.key === 'work')
        const colorHex = workLabel ? workLabel.color_hex : 'white';
        const data = {
            labels: chartData.labels,
            datasets: [{
                label: "Hours",
                borderColor: '#165cad',
                fill: false,
                data: chartData.values,
                backgroundColor: colorHex,
            }]
        }

        return (
            <Layout>
              <section>
                <div className="container">
                  <h1 className="title">
                    Trends
                  </h1>
                  <p className="subtitle">
                    Activities over time.
                  </p>
                  <div className="notification columns">
                    { this.renderDropdown() }
                  </div>

                  <div className="columns">
                    <div className="column is-3">
                      <LabelPanel
                        labels={labels}
                        updateLabel={(label) => {
                          putLabel(label, authToken).then(label => {
                            const replaceIdx = labels.findIndex(l => l.key == label.key);
                            labels[replaceIdx] = label;
                            this.setState({labels});
                          })
                        }}
                      />
                    </div>
                    <div className="column is-9">
                      <div className="card">
                        <div className="card-header">
                          <p className="card-header-title">Time spent per week</p>
                          <div className="card-header-icon" aria-label="more options">
                          <span className="icon">
                              <i className="fa fa-angle-down" aria-hidden="true"></i>
                          </span>
                          </div>
                        </div>
                        <div className="card-content">
                          <Bar data={data} options={options}/>
                        </div>
                    </div>
                    </div>
                  </div>
                </div>
              </section>
            </Layout>
        );
    }
}
  
export default Home
