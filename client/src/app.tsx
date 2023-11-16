import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, Outlet, Navigate } from 'react-router-dom'

import { RecoilRoot } from 'recoil'
import { ChakraProvider, extendTheme, defineStyle, defineStyleConfig } from '@chakra-ui/react'

import { getAuthToken } from '@/util/Api'

import Home from './routes/home'
import Auth from './routes/auth'
import Login from './routes/login'
import SignUp from './routes/signup'

import 'nprogress/nprogress.css'
import './style/index.scss'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'

const outlineButton = defineStyle({
  size: 'sm',
  border: '1px solid rgb(223, 225, 228)',
  boxShadow: 'rgb(0 0 0 / 9%) 0px 1px 1px',
  backgroundColor: 'rgb(255, 255, 255)',
  color: 'rgb(60, 65, 75)',
  _hover: {
    border: '1px solid rgb(200, 205, 208)',
  },
})

const sm = defineStyle({
  fontSize: 'xs',
  fontWeight: '500',
  px: '3',
  h: '7',
  borderRadius: 'sm',
})

export const buttonTheme = defineStyleConfig({
  sizes: { sm },
  variants: {
    outline: outlineButton,
  },
  defaultProps: {
    size: 'sm',
  },
})

const theme = extendTheme({
  fonts: {
    body: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;`,
    heading: 'Inter',
  },
  fontSizes: {
    sm: '0.8rem',
    md: '0.95rem',
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
  components: { Button: buttonTheme },
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

export const LoggedOutRoute = () => {
  const authToken = getAuthToken()

  if (authToken) {
    return <Navigate to="/" />
  }

  return <Outlet />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: 'bottom-right' } }}>
    <RecoilRoot>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoggedInRoute />}>
            <Route path="/" element={<Home />}></Route>
          </Route>
          <Route path="/" element={<LoggedOutRoute />}>
            <Route path="/login" element={<Login />}></Route>
            <Route path="/signup" element={<SignUp />}></Route>
            <Route path="/auth" element={<Auth />}></Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </RecoilRoot>
  </ChakraProvider>
)
