import { FiMap } from 'react-icons/fi'

import { Link, Flex, Input, IconButton } from '@chakra-ui/react'

const GOOGLE_MAPS_API = 'https://www.google.com/maps/search/'

export function LocationInput(props: {
  location: string
  onUpdateLocation: (location: string) => void
}) {
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

export function LocationReadOnly(props: { location: string }) {
  const { location } = props
  const searchUrl = `${GOOGLE_MAPS_API}${location}`

  return (
    <Flex w="100%" alignItems={'center'}>
      <Link size="sm" href={searchUrl} isExternal fontSize={'sm'}>
        {location}
      </Link>
    </Flex>
  )
}
