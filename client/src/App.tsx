import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import { Home } from './components/Home';

import './App.css';
import 'bulma/css/bulma.css'

class App extends Component<{}, {}> {
  options: any

  constructor(props: any) {
    super(props);
  }

  render() {
    return (
      <Router>
        <div className="App">
          <nav className="navbar" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item" href="#">
              <span className="primary">timecouncil</span>
            </a>

            <a role="button" className="navbar-burger burger" aria-label="menu" aria-expanded="false" data-target="navbarBasicExample">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>

          <div id="navbarBasicExample" className="navbar-menu">
            <div className="navbar-start">
              <a className="navbar-item">
                Trends
              </a>
              <a className="navbar-item">
                Labels
              </a>
              <a className="navbar-item">
                Calendar
              </a>
            </div>

            <div className="navbar-end">
              <div className="navbar-item">
                <div className="buttons">
                  <a className="button is-primary">
                    <strong>Sign up</strong>
                  </a>
                  <a className="button is-light">
                    Log in
                  </a>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <Route path="/" exact component={Home} />
        </div>
      </Router>
    );
  }
}

export default App;
