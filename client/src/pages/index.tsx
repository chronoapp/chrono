import React from 'react'
import Layout from '../components/Layout'
import { auth } from '../util/Api'
import Calendar from '../calendar/Calendar'
import { EventActionProvider } from '../calendar/EventActionContext'

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
        <EventActionProvider>
          <Calendar />
        </EventActionProvider>
      </Layout>
    )
  }
}

export default Home
