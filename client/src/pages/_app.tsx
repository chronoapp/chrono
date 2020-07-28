import React from 'react'
import App from 'next/app'
import { LabelsContextProvider } from '../components/LabelsContext'
import { CalendarsContextProvider } from '../components/CalendarsContext'
import { AlertsContextProvider } from '../components/AlertsContext'
import { EventActionProvider } from '../calendar/EventActionContext'
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

        <EventActionProvider>
          <LabelsContextProvider>
            <CalendarsContextProvider>
              <Component {...pageProps} />
            </CalendarsContextProvider>
          </LabelsContextProvider>
        </EventActionProvider>
      </AlertsContextProvider>
    )
  }
}

export default MyApp
