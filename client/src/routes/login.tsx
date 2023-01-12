import React from 'react'
import { motion } from 'framer-motion'
import { useForm, SubmitHandler } from 'react-hook-form'

import {
  Divider,
  FormControl,
  FormErrorMessage,
  Input,
  Flex,
  Box,
  Button,
  Text,
  Image,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

import { getGoogleOauthUrl, loginWithOTP, verifyOTPCode } from '@/util/Api'
import validator from 'validator'
import { setLocalStorageItem } from '@/lib/local-storage'
import { LoadingScreen } from '@/routes/loading'

import GoogleLogo from '@/assets/google.svg'
import ChronoLogo from '@/assets/chrono.svg'

type EmailInput = {
  email: string
}

type CodeVerifyInput = {
  loginCode: string
}

type Screen = 'login' | 'code_verification'

function LoginOptions(props: { onEnterEmail: (email: string) => void }) {
  const [isSubmittingEmail, setSubmittingEmail] = React.useState<boolean>(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EmailInput>({ reValidateMode: 'onSubmit' })

  const onSubmit: SubmitHandler<EmailInput> = (data) => {
    setSubmittingEmail(true)

    loginWithOTP(data.email)
      .then((res) => {
        props.onEnterEmail(data.email)
      })
      .catch((err) => {
        setError('email', { type: 'server', message: 'Could not sign in. Please try again later.' })
      })
      .finally(() => {
        setSubmittingEmail(false)
      })
  }

  return (
    <Box padding="5" width="400px">
      <Text textAlign="center" mt="2" fontSize="18" fontWeight={'medium'}>
        Sign in to Chrono
      </Text>

      <Button
        mt="4"
        p="2"
        pt="4"
        pb="4"
        variant="outline"
        w="100%"
        onClick={() => (window.location.href = getGoogleOauthUrl())}
      >
        <img src={GoogleLogo} style={{ width: '40px', paddingRight: 5 }}></img>
        <Text fontSize={'sm'} fontWeight={'medium'}>
          Continue with Google
        </Text>
      </Button>

      <Flex mt="5" mb="5" align={'center'}>
        <Divider />
      </Flex>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl mt="2" isInvalid={!!errors.email}>
          <Input
            className="input"
            type="text"
            placeholder="Email"
            disabled={isSubmittingEmail}
            {...register('email', {
              required: true,
              validate: {
                invalidEmail: (v) => {
                  return validator.isEmail(v)
                },
              },
            })}
          />
          {errors.email?.type == 'server' && (
            <FormErrorMessage fontSize={'xs'}>{errors.email?.message}</FormErrorMessage>
          )}
          {errors.email?.type == 'invalidEmail' && (
            <FormErrorMessage fontSize={'xs'}>Please enter a valid email address.</FormErrorMessage>
          )}
          {errors.email?.type === 'required' && (
            <FormErrorMessage fontSize={'xs'}>Please enter an email address.</FormErrorMessage>
          )}
        </FormControl>

        <Button
          variant="outline"
          mt="2"
          p="2"
          pt="4"
          pb="4"
          w="100%"
          isLoading={isSubmittingEmail}
          type="submit"
        >
          <Text fontSize={'sm'} fontWeight={'medium'}>
            Continue with Email
          </Text>
        </Button>
      </form>
    </Box>
  )
}

function CodeVerification(props: {
  email: string
  onBackToLogin: () => void
  onVerifyCode: () => void
}) {
  const [isSubmittingLoginCode, setisSubmittingLoginCode] = React.useState<boolean>(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CodeVerifyInput>({ reValidateMode: 'onSubmit' })

  const onSubmit: SubmitHandler<CodeVerifyInput> = async (data) => {
    if (props.email && data.loginCode) {
      setisSubmittingLoginCode(true)

      const result = await verifyOTPCode(props.email, data.loginCode)
      const respData = await result.json()

      if (result.ok) {
        const tokenData = {
          token: respData.token,
        }
        setLocalStorageItem('auth_token', tokenData)
        props.onVerifyCode()
      } else {
        setError('loginCode', { type: 'server', message: 'Invalid code. Please try again.' })
      }

      setisSubmittingLoginCode(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Flex padding="5" alignItems={'center'} direction="column">
        <Text textAlign="center" mt="2" fontSize="18" fontWeight={'medium'}>
          Check your email
        </Text>

        <Text textAlign="center" mt="2" color="gray.700" fontSize={'sm'}>
          We've set a temporary login link.
        </Text>
        <Text textAlign="center" mt="1" color="gray.700" fontSize={'sm'}>
          Please check your inbox at <b>{props.email}</b>.
        </Text>

        <Flex mt="5" direction={'column'} alignItems="center">
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormControl mt="2" isInvalid={!!errors.loginCode}>
              <Input
                className="input"
                type="number"
                placeholder="enter code"
                disabled={isSubmittingLoginCode}
                {...register('loginCode', {
                  required: true,
                })}
              />
              {errors.loginCode?.type === 'required' && (
                <FormErrorMessage fontSize={'xs'}>Please enter a login code.</FormErrorMessage>
              )}
              {errors.loginCode?.type === 'server' && (
                <FormErrorMessage fontSize={'xs'}>{errors.loginCode.message}</FormErrorMessage>
              )}
            </FormControl>

            <Button
              mt="4"
              p="2"
              w="100%"
              colorScheme={'primary'}
              fontSize="sm"
              isLoading={isSubmittingLoginCode}
              type="submit"
            >
              Continue with login code
            </Button>
          </form>

          <Button
            variant="link"
            mt="12"
            color={'gray.500'}
            fontWeight="medium"
            fontSize={'sm'}
            onClick={props.onBackToLogin}
          >
            Back to login
          </Button>
        </Flex>
      </Flex>
    </motion.div>
  )
}

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = React.useState<string>('')
  const [screen, setScreen] = React.useState<Screen>('login')
  const [redirectingToMainScreen, setRedirectingToMainScreen] = React.useState<boolean>(false)

  function renderLoginOrVerifyCode() {
    if (screen === 'login') {
      return (
        <LoginOptions
          onEnterEmail={(email) => {
            setEmail(email)
            setScreen('code_verification')
          }}
        />
      )
    } else if (screen === 'code_verification') {
      return (
        <CodeVerification
          email={email}
          onVerifyCode={() => {
            setRedirectingToMainScreen(true)
            setTimeout(() => {
              navigate('/')
            }, 500)
          }}
          onBackToLogin={() => {
            setScreen('login')
            setEmail('')
          }}
        />
      )
    }
  }

  if (redirectingToMainScreen) {
    return <LoadingScreen />
  } else {
    return (
      <Box position="fixed" top="30%" left="50%" transform="translate(-50%, -30%)">
        <Flex alignItems="center" justifyContent="center">
          <Image src={ChronoLogo} alt="Chrono logo" boxSize={'4em'} />
        </Flex>

        {renderLoginOrVerifyCode()}
      </Box>
    )
  }
}

export default Login
