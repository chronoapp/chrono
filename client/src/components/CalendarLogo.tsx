import GoogleLogo from '@/assets/google.svg'
import ChronoLogo from '@/assets/chrono.svg'

import { CalendarProvider } from '@/models/CalendarAccount'

interface CalendarLogoProps {
  source: CalendarProvider
  size: number
}

function CalendarLogo({ source, size }: CalendarLogoProps) {
  if (source === 'google') {
    return <img src={GoogleLogo} width={size} />
  } else {
    return <img src={ChronoLogo} width={size} height="100%" />
  }
}

export default CalendarLogo
