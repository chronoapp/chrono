import * as React from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'

import { signOut } from '../util/Api'
import LabelPanel from './LabelPanel'

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
  function renderNavItems() {
    const router = useRouter()

    return (
      <div id="navbarBasicExample" className="navbar-menu">
        <div className="navbar-start">
          <Link href="/">
            <a
              className={clsx({
                'navbar-item': true,
                'is-active': router.pathname == '/',
              })}
            >
              Calendar
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

  return (
    <div className="App">
      <Head>
        <title>{props.title}</title>
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

        {renderNavItems()}
      </nav>

      <div className="app-content">
        <div className="left-section">
          <LabelPanel />
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
