import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { RecoilRoot } from 'recoil'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'

import Home from './routes/home'

import 'nprogress/nprogress.css'
import './style/index.scss'

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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <RecoilRoot>
          <Routes>
            <Route path="/" element={<Home />}></Route>
          </Routes>
        </RecoilRoot>
      </ChakraProvider>
    </BrowserRouter>
  </React.StrictMode>
)
