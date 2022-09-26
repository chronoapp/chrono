import React from 'react'
import App from 'next/app'
import Router from 'next/router'
import NProgress from 'nprogress'
import { RecoilRoot } from 'recoil'

import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { CalendarsContextProvider } from '@/contexts/CalendarsContext'
import { EventActionProvider } from '@/contexts/EventActionContext'

Router.events.on('routeChangeStart', () => NProgress.start())
Router.events.on('routeChangeComplete', () => NProgress.done())
Router.events.on('routeChangeError', () => NProgress.done())
NProgress.configure({ showSpinner: false })

import 'nprogress/nprogress.css'
import 'style/index.scss'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'

const theme = extendTheme({
  fonts: {
    body: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;`,
    heading: 'Inter',
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
        <EventActionProvider>
          <CalendarsContextProvider>
            <RecoilRoot>
              <Component {...pageProps} />
            </RecoilRoot>
          </CalendarsContextProvider>
        </EventActionProvider>
      </ChakraProvider>
    )
  }
}

export default MyApp
