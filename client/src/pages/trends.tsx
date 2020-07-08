import * as React from 'react'
import { Bar } from 'react-chartjs-2'

import Layout from '../components/Layout'
import { getTrends, getAuthToken, auth } from '../util/Api'
import { Label, TimePeriod } from '../models/Label'

import { LabelContext } from '../components/LabelsContext'

interface Props {
  authToken: string
  label: Label
}

interface State {
  timespanDropdownActive: boolean
  labelDropdownActive: boolean
  selectedLabel: Label | null
  trends: any

  selectedTimePeriod: TimePeriod
}

/**
 * List of trends.
 */
class Trends extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      timespanDropdownActive: false,
      labelDropdownActive: false,
      selectedLabel: null,
      trends: {},

      selectedTimePeriod: 'WEEK',
    }

    this.toggleDropdown = this.toggleDropdown.bind(this)
    this.onTimePeriodSelected = this.onTimePeriodSelected.bind(this)
  }

  static async getInitialProps(ctx) {
    const authToken = auth(ctx)
    return { authToken }
  }

  async componentDidMount() {
    const trends = await getTrends(this.props.authToken, this.state.selectedTimePeriod)

    this.setState({
      trends,
    })
  }

  toggleDropdown() {
    const timespanDropdownActive = !this.state.timespanDropdownActive
    this.setState({ timespanDropdownActive: timespanDropdownActive })
  }

  onTimePeriodSelected(timePeriod: TimePeriod) {
    this.setState({ selectedTimePeriod: timePeriod })

    getTrends(this.props.authToken, timePeriod).then((trends) => {
      this.setState({ trends })
    })
  }

  renderDropdown() {
    return (
      <div
        className={`dropdown is-hoverable ${this.state.timespanDropdownActive ? 'is-active' : ''}`}
      >
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
            <a className="dropdown-item">7 days</a>
            <a className="dropdown-item">14 days</a>
          </div>
        </div>
      </div>
    )
  }

  renderTimePeriodSelections() {
    const { selectedTimePeriod } = this.state
    return (
      <div className="field has-addons">
        <button
          onClick={() => this.onTimePeriodSelected('DAY')}
          className={`button is-small ${selectedTimePeriod === 'DAY' ? 'is-active' : ''}`}
        >
          Day
        </button>
        <button
          onClick={() => this.onTimePeriodSelected('WEEK')}
          className={`button is-small ${selectedTimePeriod === 'WEEK' ? 'is-active' : ''}`}
        >
          Week
        </button>
        <button
          onClick={() => this.onTimePeriodSelected('MONTH')}
          className={`button is-small ${selectedTimePeriod === 'MONTH' ? 'is-active' : ''}`}
        >
          Month
        </button>
      </div>
    )
  }

  render() {
    return (
      <Layout>
        <div className="container">
          <div className="level">
            <div className="level-left"></div>
            <div className="level-right">{this.renderTimePeriodSelections()}</div>
          </div>

          <div>
            <p className="card-header-title">
              Time spent on &nbsp;
              <span className="tag is-light">Work</span>&nbsp; per week
            </p>
          </div>
          <LabelContext.Consumer>
            {({ labelState: { labels } }) => (
              <div className="card-content">{this.renderChart(labels)}</div>
            )}
          </LabelContext.Consumer>
        </div>
      </Layout>
    )
  }

  renderChart(labels: Label[]) {
    const { trends } = this.state

    const options = {
      title: {
        text: 'Work over Time',
      },
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
      scales: {
        yAxes: [
          {
            display: true,
            ticks: {
              suggestedMin: 0, // minimum will be 0, unless there is a lower value.
            },
            scaleLabel: {
              display: true,
              labelString: 'Hours per 7 days',
            },
          },
        ],
      },
      legend: {
        display: false,
      },
    }

    const workLabel = labels.find((label) => label.key === 'work')
    const colorHex = workLabel ? workLabel.color_hex : 'white'
    const data = {
      labels: trends.labels,
      datasets: [
        {
          label: 'Hours',
          borderColor: '#165cad',
          fill: false,
          data: trends.values,
          backgroundColor: colorHex,
        },
      ],
    }
    return <Bar data={data} options={options} />
  }
}

export default Trends
