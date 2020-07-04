import React from 'react'
import App from 'next/app'
import { LabelsContextProvider } from '../components/LabelsContext'

/**
 * Custom Page Initiation.
 * TODO: Move common state to a merged context.
 */
class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props

    return (
      <LabelsContextProvider>
        <Component {...pageProps} />
      </LabelsContextProvider>
    )
  }
}

export default MyApp
