import * as React from 'react';
import Link from 'next/link'
import Head from 'next/head'
import { getOauthUrl } from '../util/Api';

// import 'font-awesome/css/font-awesome.min.css';
import '../style/index.sass'
import '../style/app.scss';

export default ({ children, title = 'Timecouncil' }) => (
  <div className="App">
    <Head>
      <title>{title}</title>
      <meta charSet='utf-8' />
      <meta name='viewport' content='initial-scale=1.0, width=device-width' />
    </Head>

    <div>
        <nav className="navbar" role="navigation" aria-label="main navigation">
            <div className="navbar-brand">
            <a className="navbar-item" href="#">
                <span className="primary">timecouncil</span>
            </a>

            <a role="button"
                className="navbar-burger burger"
                aria-label="menu"
                aria-expanded="false"
                data-target="navbarBasicExample">
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
            </a>
            </div>

            <div id="navbarBasicExample" className="navbar-menu">
            <div className="navbar-start">
                <Link href='/'><a className="navbar-item">Trends</a></Link>
                <Link href='/events'><a className="navbar-item">Events</a></Link>
                <Link href='/categories'><a className="navbar-item">Categories</a></Link>
                <a className="navbar-item">Calendar</a>
            </div>

            <div className="navbar-end">
                <div className="navbar-item">
                <div className="buttons">
                    <Link href={getOauthUrl()}><a className="button is-primary"><strong>Log in</strong></a></Link>
                </div>
                </div>
            </div>
            </div>
        </nav>
    </div>

    {children}

    <footer></footer>
  </div>
)
