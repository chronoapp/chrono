import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, Outlet, Navigate } from 'react-router-dom'

import { RecoilRoot } from 'recoil'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { getAuthToken } from '@/util/Api'

import Home from './routes/home'
import Settings from './routes/settings'
import Auth from './routes/auth'
import Login from './routes/login'

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

/**
 * Makes sure we have an authenticated user before rendering the app.
 */
export const LoggedInRoute = () => {
  const authToken = getAuthToken()

  if (!authToken) {
    return <Navigate to="/login" />
  }

  return <Outlet />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ChakraProvider theme={theme}>
    <RecoilRoot>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoggedInRoute />}>
            <Route path="/" element={<Home />}></Route>
            <Route path="/settings" element={<Settings />}></Route>
          </Route>
          <Route path="/login" element={<Login />}></Route>
          <Route path="/auth" element={<Auth />}></Route>
        </Routes>
      </BrowserRouter>
    </RecoilRoot>
  </ChakraProvider>
)
