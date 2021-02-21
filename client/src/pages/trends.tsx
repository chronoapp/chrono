import React, { useState, useContext } from 'react'

import { LabelContext, LabelContextType } from '../components/LabelsContext'
import Layout from '../components/Layout'
import { auth } from '../util/Api'

import HabitGraph from '../trends/HabitGraph'
import TrendChart from '../trends/TrendChart'
import { TrendView } from '../trends/ViewSelector'
import { Label } from '../models/Label'

interface IProps {
  authToken: string
}

function Trends(props: IProps) {
  const [selectedView, setSelectedView] = useState<TrendView>('CHART')
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const [selectedLabel, setSelectedLabel] = useState<Label | undefined>(getDefaultLabel())

  function getDefaultLabel() {
    const allLabels = Object.values(labelState.labelsById)
    return allLabels && allLabels.length > 0 ? allLabels[0] : undefined
  }

  if (selectedView === 'CHART') {
    return (
      <TrendChart
        selectedLabel={selectedLabel}
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        authToken={props.authToken}
        setSelectedView={setSelectedView}
      />
    )
  } else {
    return (
      <HabitGraph
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        selectedLabel={selectedLabel}
        setSelectedView={setSelectedView}
      />
    )
  }
}

class TrendsPage extends React.Component<{ authToken: string }, {}> {
  static async getInitialProps(ctx) {
    const authToken = auth(ctx)
    return { authToken }
  }

  render() {
    return (
      <Layout>
        <Trends authToken={this.props.authToken} />
      </Layout>
    )
  }
}

export default TrendsPage
