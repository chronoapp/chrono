import { atom } from 'recoil'
import User from '@/models/User'

export const userState = atom({
  key: 'user-state',
  default: undefined as User | undefined,
})
