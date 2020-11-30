import React, { useState } from 'react'

import Layout from '../components/Layout'

function Settings() {
  return (
    <Layout canCreateEvent={true} includeLeftPanel={false}>
      <div className="mt-2 container has-text-left is-max-desktop">
        <h1 className="title">Settings</h1>
        <h2 className="subtitle">Customize your calendar settings.</h2>
      </div>
    </Layout>
  )
}

export default Settings
