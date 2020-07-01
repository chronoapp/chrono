import * as React from 'react'
import { Bar } from 'react-chartjs-2'

import Layout from '../components/Layout'
import ColorPicker from '../components/ColorPicker'
import { getTrends, getAuthToken } from '../util/Api'
import { Label, TimePeriod } from '../models/Label'
import { LABEL_COLORS } from '../models/LabelColors'

import { LabelContext } from '../components/LabelsContext'

interface Props {
  authToken: string
  label: Label
}

interface ProjectModalState {
  modalActive: boolean
}

interface State {
  timespanDropdownActive: boolean
  labelDropdownActive: boolean
  selectedLabel: Label | null
  trends: any

  projectModal: ProjectModalState | null
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

      projectModal: null,
      selectedTimePeriod: 'WEEK',
    }

    this.toggleDropdown = this.toggleDropdown.bind(this)
    this.onClickAddProject = this.onClickAddProject.bind(this)
    this.onTimePeriodSelected = this.onTimePeriodSelected.bind(this)
  }

  static async getInitialProps({ req }) {
    const authToken = getAuthToken(req)
    return { authToken }
  }

  static contextType = LabelContext

  async componentDidMount() {
    const authToken = getAuthToken()
    const trends = await getTrends(authToken, this.state.selectedTimePeriod)

    this.setState({
      trends,
    })
  }

  onClickAddProject() {
    const labelHex = LABEL_COLORS[0].hex
    const projectModal = {
      modalActive: true,
      label: new Label(-1, 0, '', '', labelHex),
    }
    this.setState({ projectModal })
  }

  toggleDropdown() {
    const timespanDropdownActive = !this.state.timespanDropdownActive
    this.setState({ timespanDropdownActive: timespanDropdownActive })
  }

  onTimePeriodSelected(timePeriod: TimePeriod) {
    this.setState({ selectedTimePeriod: timePeriod })

    getTrends(getAuthToken(), timePeriod).then((trends) => {
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
    const { authToken } = this.props

    if (!authToken) {
      return <Layout loggedIn={false} children={null} />
    }

    return (
      <Layout>
        {this.renderProjectLabelModal()}

        <div className="container">
          <div className="level">
            <div className="level-left"></div>
            <div className="level-right">{this.renderTimePeriodSelections()}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <p className="card-header-title">
                Time spent on &nbsp;
                <span className="tag is-light">Work</span>&nbsp; per week
              </p>
              <div className="card-header-icon" aria-label="more options">
                <span className="icon">
                  <i className="fa fa-angle-down" aria-hidden="true"></i>
                </span>
              </div>
            </div>
            <LabelContext.Consumer>
              {({ labelState: { labels } }) => (
                <div className="card-content">{this.renderChart(labels)}</div>
              )}
            </LabelContext.Consumer>
          </div>
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

  renderProjectLabelModal() {
    const { projectModal } = this.state
    if (!projectModal) {
      return null
    }

    return (
      <div className={`modal ${projectModal.modalActive ? 'is-active' : null}`}>
        <div className="modal-background"></div>
        <div className="modal-card">
          <header className="modal-card-head">
            <p className="modal-card-title">Add Project</p>
          </header>
          <section className="modal-card-body">
            <div className="field">
              <div className="control">
                <label className="label">Project Name</label>
                <input className="input" type="text" placeholder="" />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <label className="label">Color</label>
                <div
                  onClick={(_) => {}}
                  className="event-label event-label--hoverable dropdown-trigger"
                ></div>
                <ColorPicker
                  onSelectLabelColor={(labelColor) => {
                    console.log(`SELECTED: ${labelColor}`)
                  }}
                />
              </div>
            </div>
          </section>
          <footer className="modal-card-foot">
            <button className="button is-link">Add</button>
            <button
              className="button"
              onClick={() => {
                projectModal.modalActive = false
                this.setState({ projectModal })
              }}
            >
              Cancel
            </button>
          </footer>
        </div>
      </div>
    )
  }
}

export default Trends
