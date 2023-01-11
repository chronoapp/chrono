import React from 'react'
import { useNavigate } from 'react-router-dom'

import useQuery from '@/lib/hooks/useQuery'
import { setLocalStorageItem } from '@/lib/local-storage'

import { authenticate } from '@/util/Api'
import * as dates from '@/util/dates'

/**
 * Callback after Oauth redirect.
 */
function Auth() {
  const query = useQuery()
  const navigate = useNavigate()

  React.useEffect(() => {
    validateTokenAndRedirect()
  }, [])

  async function validateTokenAndRedirect() {
    const code = query.get('code')
    const state = query.get('state')

    if (!code || !state) {
      navigate('/login')
    } else {
      const resp = await authenticate(code, state)
      const tokenData = {
        token: resp.token,
        expires: dates.add(Date.now(), 30, 'day'),
      }
      setLocalStorageItem('auth_token', tokenData)

      navigate('/')
    }
  }

  return <div>Authenticating..</div>
}

export default Auth
