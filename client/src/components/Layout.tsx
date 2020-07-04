import * as React from 'react'
import Link from 'next/link'
import Head from 'next/head'

import { getOauthUrl, signOut } from '../util/Api'
import LabelPanel from './LabelPanel'
import { LabelsContextProvider } from './LabelsContext'
import Login from './Login'

import '../style/index.sass'
import '../style/app.scss'

interface Props {
  title: string
  children: any
}

/**
 * Top Level Layout for the navigation and body.
 */
export default class Layout extends React.Component<Props, {}> {
  static defaultProps = {
    title: 'Timecouncil',
  }

  renderNavItems() {
    return (
      <div id="navbarBasicExample" className="navbar-menu">
        <div className="navbar-start">
          <Link href="/">
            <a className="navbar-item">Calendar</a>
          </Link>
          <Link href="/trends">
            <a className="navbar-item">Trends</a>
          </Link>
          <Link href="/events">
            <a className="navbar-item">Events</a>
          </Link>
        </div>
        <div className="navbar-end">
          <div className="navbar-item">
            <div className="buttons">
              <a onClick={signOut} className="button is-white">
                Log out
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  render() {
    return (
      <div className="App">
        <Head>
          <title>{this.props.title}</title>
          <meta charSet="utf-8" />
          <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>

        <nav className="navbar" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item" href="#">
              <span className="primary">timecouncil</span>
            </a>

            <a
              role="button"
              className="navbar-burger burger"
              aria-label="menu"
              aria-expanded="false"
              data-target="navbarBasicExample"
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>

          {this.renderNavItems()}
        </nav>

        <div className="app-content">
          <LabelsContextProvider>
            <div className="left-section">
              <LabelPanel />
            </div>
            {this.props.children}
          </LabelsContextProvider>
        </div>

        <footer></footer>
      </div>
    )
  }
}
