import * as React from 'react'
import { getGoogleOauthUrl, getMsftOauthUrl } from '../util/Api'
import '../style/index.scss'

/**
 * TODO: Redirect to home if already logged in.
 */
function Login(props) {
  return (
    <div
      style={{
        width: '400px',
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -30%)',
      }}
    >
      <div className="has-text-centered">
        <img src={'./timecouncil-logo-250.jpg'} style={{ width: '15em' }} />
      </div>
      <div className="card mt-3">
        <div className="card-content">
          <h2 className="has-text-centered is-size-6">Sign in to Timecouncil</h2>
          <br />

          <button
            onClick={() => (window.location.href = getGoogleOauthUrl())}
            className="button is-size-6"
            style={{ width: '100%' }}
          >
            <img src={'./google.svg'} style={{ width: '40px', paddingRight: 5 }}></img> Continue
            with Google
          </button>

          <button
            onClick={() => (window.location.href = getMsftOauthUrl())}
            className="button is-size-6 mt-2"
            style={{ width: '100%' }}
          >
            <img src={'./microsoft-logo.png'} style={{ width: '32px', paddingRight: 5 }}></img>{' '}
            Continue with Microsoft
          </button>
          <hr />

          <p className="has-text-centered has-text-grey">Or, sign in with email</p>

          <div className="field">
            <label className="label">Email</label>
            <div className="control has-icons-left has-icons-right">
              <input className="input is-success" type="text" placeholder="Email" />
              <span className="icon is-small is-left">
                <i className="fas fa-user"></i>
              </span>
              <span className="icon is-small is-right">
                <i className="fas fa-check"></i>
              </span>
            </div>
          </div>

          <div className="field">
            <label className="label">Password</label>
            <div className="control has-icons-left has-icons-right">
              <input className="input is-success" type="text" placeholder="Password" />
              <span className="icon is-small is-left">
                <i className="fas fa-user"></i>
              </span>
              <span className="icon is-small is-right">
                <i className="fas fa-check"></i>
              </span>
            </div>
          </div>

          <button className="button is-size-6 is-primary" style={{ width: '100%' }}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
