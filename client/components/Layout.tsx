import * as React from 'react';
import Link from 'next/link'
import Head from 'next/head'
import { getOauthUrl, signOut } from '../util/Api';

import '../style/index.sass'
import '../style/app.scss';

interface Props {
    title: string,
    children: any,
    loggedIn: boolean,
}

export default class Layout extends React.Component<Props, {}> {
    static defaultProps = {
        title: 'Timecouncil',
        loggedIn: true
    }

    renderNavItems() {
        const startNavItems = this.props.loggedIn ? (
                <div className="navbar-start">
                    <Link href='/'><a className="navbar-item">Trends</a></Link>
                    <Link href='/events'><a className="navbar-item">Events</a></Link>
                    <Link href='/calendar'><a className="navbar-item">Calendar</a></Link>
                </div>
            ) : null;

        const endNavItems = this.props.loggedIn ? (
            <a onClick={signOut} className="button is-white">Log out</a>
        ) : (
            <Link href={getOauthUrl()}>
                <a className="button is-primary"><strong>Log in</strong></a>
            </Link>
        );

        return (
            <div id="navbarBasicExample" className="navbar-menu">
                {startNavItems}

                <div className="navbar-end">
                    <div className="navbar-item">
                        <div className="buttons">
                            {endNavItems}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    renderChildren() {
        if (this.props.loggedIn) {
            return this.props.children;
        } else {
            return (
                <div className="hero">
                    <div className="hero-body">
                        <div className="container">
                            <h1 className="title">
                                Time tracking with google calendar
                            </h1>
                            <h2 className="subtitle">
                                Track your creative / project / work hours.
                            </h2>
                        </div>
                    </div>
                </div>
            )
        }
    }

    render() {
        return (
          <div className="App">
            <Head>
              <title>{this.props.title}</title>
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

                    {this.renderNavItems()}
                </nav>
            </div>

            {this.renderChildren()}

            <footer></footer>
          </div>
        )
    }
}
