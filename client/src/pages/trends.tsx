import React, { useState } from 'react'

import Layout from '../components/Layout'
import { auth } from '../util/Api'

import HabitGraph from '../trends/HabitGraph'
import TrendChart from '../trends/TrendChart'
import { TrendView } from '../trends/ViewSelector'

interface IProps {
  authToken: string
}

function Trends(props: IProps) {
  const [selectedView, setSelectedView] = useState<TrendView>('CHART')

  if (selectedView === 'CHART') {
    return <TrendChart authToken={props.authToken} setSelectedView={setSelectedView} />
  } else {
    return <HabitGraph setSelectedView={setSelectedView} />
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
