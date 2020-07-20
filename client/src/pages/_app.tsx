import React from 'react'
import App from 'next/app'
import { LabelsContextProvider } from '../components/LabelsContext'
import { CalendarsContextProvider } from '../components/CalendarsContext'
import { AlertsContextProvider } from '../components/AlertsContext'
import { Alerts } from '../components/Alerts'

/**
 * Custom Page Initiation.
 * TODO: Move common state to a merged context.
 */
class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props

    return (
      <AlertsContextProvider>
        <Alerts />

        <LabelsContextProvider>
          <CalendarsContextProvider>
            <Component {...pageProps} />
          </CalendarsContextProvider>
        </LabelsContextProvider>
      </AlertsContextProvider>
    )
  }
}

export default MyApp
