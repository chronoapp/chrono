import React, { useState, useContext } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Icon from '@mdi/react'
import { mdiDotsHorizontal } from '@mdi/js'

import { getAuthToken, signOut, syncCalendar } from '../util/Api'
import MiniCalendar from '../calendar/MiniCalendar'
import LabelPanel from './LabelPanel'
import CalendarsPanel from './CalendarsPanel'
import { AlertsContext } from '../components/AlertsContext'
import { GlobalEvent } from '../util/global'

import '../style/index.scss'

interface Props {
  title: string
  children: any
}

/**
 * Top Level Layout for the navigation and body.
 */
// export default class Layout extends React.Component<Props, {}> {
function Layout(props: Props) {
  const [settingsActive, setSettingsActive] = useState(false)
  const alertsContext = useContext(AlertsContext)

  async function refreshCalendar() {
    setSettingsActive(false)
    alertsContext.addMessage('Updating calendar..')
    await syncCalendar(getAuthToken())
    alertsContext.addMessage('Calendar updated.')
    document.dispatchEvent(new Event(GlobalEvent.refreshCalendar))
  }

  function Settings() {
    return (
      <div className={clsx('dropdown', settingsActive && 'is-active')}>
        <div className="dropdown-trigger" onClick={() => setSettingsActive(!settingsActive)}>
          <button className="button is-text">
            <Icon size={1} path={mdiDotsHorizontal}></Icon>
          </button>
        </div>
        <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
          <div className="dropdown-content has-text-left">
            <a className="dropdown-item" onClick={refreshCalendar}>
              Refresh Events
            </a>
            <hr style={{ margin: 0 }} />
            <a className="dropdown-item" onClick={signOut}>
              Sign Out
            </a>
          </div>
        </div>
      </div>
    )
  }

  function renderNavItems() {
    const router = useRouter()

    return (
      <div id="navbar" className="navbar-menu">
        <div className="navbar-start">
          <Link href="/">
            <a className={clsx('pl-0', 'navbar-item', router.pathname == '/' && 'is-active')}>
              Calendar
            </a>
          </Link>
          <Link href="/events">
            <a
              className={clsx({
                'navbar-item': true,
                'is-active': router.pathname == '/events',
              })}
            >
              Events
            </a>
          </Link>
          <Link href="/trends">
            <a
              className={clsx({
                'navbar-item': true,
                'is-active': router.pathname == '/trends',
              })}
            >
              Trends
            </a>
          </Link>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <Settings />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <Head>
        <title>{props.title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <link rel="shortcut icon" href="/favicon-128.ico" type="image/x-icon" />
        <link rel="icon" href="/favicon-128.ico" type="image/x-icon" />
      </Head>

      <nav className="navbar" role="navigation" aria-label="main navigation">
        <div className="navbar-brand">
          <a className="navbar-item" href="#">
            <img
              src={'./timecouncil-symbol.png'}
              style={{ maxHeight: '2.5rem', width: '2.5rem' }}
            />
          </a>

          <a
            role="button"
            className="navbar-burger burger"
            aria-label="menu"
            aria-expanded="false"
            data-target="navbar"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </a>
        </div>

        {renderNavItems()}
      </nav>

      <div className="app-content">
        <div className="left-section">
          <MiniCalendar />
          <LabelPanel />
          <CalendarsPanel />
        </div>
        {props.children}
      </div>

      <footer></footer>
    </div>
  )
}

Layout.defaultProps = {
  title: 'Timecouncil',
}

export default Layout
