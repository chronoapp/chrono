import React from 'react'
import Layout from '../components/Layout'
import { auth } from '../util/Api'
import Calendar from '../calendar/Calendar'

interface Props {
  authToken: string
}
interface State {}

class Home extends React.Component<Props, State> {
  static async getInitialProps(ctx) {
    const authToken = auth(ctx)
    return { authToken }
  }

  render() {
    return (
      <Layout>
        <Calendar />
      </Layout>
    )
  }
}

export default Home
