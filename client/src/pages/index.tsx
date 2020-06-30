import React from 'react'
import Layout from '../components/Layout'

import Calendar from '../calendar/Calendar'

interface Props {}
interface State {}

class Home extends React.Component<Props, State> {
  render() {
    return (
      <Layout>
        <Calendar />
      </Layout>
    )
  }
}

export default Home
