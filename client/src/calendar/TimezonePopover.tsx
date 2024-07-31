import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverCloseButton,
  IconButton,
} from '@chakra-ui/react'
import { useRecoilState } from 'recoil'
import TimezoneSelector from '../components/settings/TimezoneSelector'
import { userState } from '@/state/UserState'
import { FiPlus } from 'react-icons/fi'

const TimezonePopover = ({ isOpen, onOpen, onClose, addTimezones }) => {
  const [user, setUser] = useRecoilState(userState)

  return (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-end">
      <PopoverTrigger>
        <IconButton
          size={'xs'}
          variant="ghost"
          aria-label="adding additional timezones"
          icon={<FiPlus />}
          width="4"
          onClick={onOpen}
        />
      </PopoverTrigger>
      <PopoverContent width="350px" marginLeft="50px" boxShadow="lg">
        <PopoverCloseButton />
        <PopoverBody>
          <TimezoneSelector
            user={user!}
            onAddTimezone={(tz) => {
              addTimezones(tz)
              onClose()
            }}
          />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

export default TimezonePopover
