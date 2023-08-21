import { FiMap } from 'react-icons/fi'

import { Flex, Input, IconButton } from '@chakra-ui/react'

interface IProps {
  location: string
  onUpdateLocation: (location: string) => void
}

const GOOGLE_MAPS_API = 'https://www.google.com/maps/search/'

export default function LocationInput(props: IProps) {
  const { location, onUpdateLocation } = props

  return (
    <Flex w="100%" alignItems={'center'}>
      <Input
        size="sm"
        variant="ghost"
        className="input-bg"
        placeholder="Add location"
        value={location || ''}
        onChange={(e) => {
          onUpdateLocation(e.target.value)
        }}
      />

      {location && (
        <IconButton
          variant={'ghost'}
          ml="2"
          size="sm"
          icon={<FiMap />}
          onClick={() => {
            const searchUrl = `${GOOGLE_MAPS_API}${location}`
            window.open(searchUrl, '_blank')
          }}
          aria-label="search location"
        />
      )}
    </Flex>
  )
}
