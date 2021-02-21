import React from 'react'
import App from 'next/app'

import { ChakraProvider, extendTheme } from '@chakra-ui/react'

import { LabelsContextProvider } from '../components/LabelsContext'
import { CalendarsContextProvider } from '../components/CalendarsContext'
import { AlertsContextProvider } from '../components/AlertsContext'
import { EventActionProvider } from '../calendar/EventActionContext'
import { Alerts } from '../components/Alerts'

const theme = extendTheme({
  fonts: {
    body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;`,
  },
  colors: {
    primary: {
      100: '#ebedff',
      200: '#c7cdef',
      300: '#a2acde',
      400: '#7d8ace',
      500: '#5969bf',
      600: '#404fa6',
      700: '#313e82',
      800: '#232c5e',
      900: '#131a3b',
      1000: '#04091a',
    },
  },
})

/**
 * Custom Page Initiation.
 * TODO: Move common state to a merged context.
 */
class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props

    return (
      <ChakraProvider theme={theme}>
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
      </ChakraProvider>
    )
  }
}

export default MyApp
