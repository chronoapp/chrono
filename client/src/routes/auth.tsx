import React from 'react'
import { useNavigate } from 'react-router-dom'

import useQuery from '@/lib/hooks/useQuery'
import { setLocalStorageItem } from '@/lib/local-storage'

import { authenticateGoogleOauth } from '@/util/Api'
import NProgress from 'nprogress'

import LoadingScreen from '@/components/LoadingScreen'

/**
 * Callback after Oauth redirect.
 */
function Auth() {
  const query = useQuery()
  const navigate = useNavigate()

  NProgress.configure({ showSpinner: false })
  NProgress.start()

  React.useEffect(() => {
    validateTokenAndRedirect()
  }, [])

  async function validateTokenAndRedirect() {
    const code = query.get('code')
    const state = query.get('state')

    if (!code || !state) {
      navigate('/login')
    } else {
      const resp = await authenticateGoogleOauth(code, state)

      const today = new Date()
      const expireDate = new Date()
      expireDate.setDate(today.getDate() + 30)

      const tokenData = {
        token: resp.token,
        expires: expireDate,
      }

      setLocalStorageItem('auth_token', tokenData)
    }

    setTimeout(() => {
      NProgress.done()
      navigate('/')
    }, 500)
  }

  return <LoadingScreen />
}

export default Auth
