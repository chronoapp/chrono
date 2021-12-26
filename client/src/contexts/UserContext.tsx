import React from 'react'

export interface UserContextType {
  defaultTimezone: string
}

export const UserContext = React.createContext<UserContextType>(undefined!)
