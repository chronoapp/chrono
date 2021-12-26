import React from 'react'
import { authenticate } from '../util/Api'
import Cookies from 'universal-cookie'
import * as dates from '../util/dates'

class Auth extends React.Component<{ query: any; resp: any }, {}> {
  static async getInitialProps({ query }: any) {
    return { query }
  }

  public async componentDidMount() {
    const { code, state } = this.props.query

    const cookies = new Cookies()
    const resp = await authenticate(code, state)
    cookies.set('auth_token', resp.token, { expires: dates.add(Date.now(), 30, 'day') })

    window.location.replace('/')
  }

  public render() {
    // TODO: Handle errors.
    return <div>Authenticating..</div>
  }
}

export default Auth
