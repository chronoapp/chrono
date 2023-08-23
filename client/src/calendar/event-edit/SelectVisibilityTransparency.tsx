import { Transparency, Visibility } from '@/models/Event'
import { FiChevronDown } from 'react-icons/fi'
import { Flex, Menu, Button, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'

interface IProps {
  visibility: Visibility
  transparency: Transparency

  onVisibilityChange: (visibility: Visibility) => void
  onTransparencyChange: (transparency: Transparency) => void
}

function freeBusyText(transparency: Transparency) {
  switch (transparency) {
    case 'opaque':
      return 'Busy'
    case 'transparent':
      return 'Free'
  }
}

function visibilityText(visibility: Visibility) {
  switch (visibility) {
    case 'default':
      return 'Default visibility'
    case 'public':
      return 'Public'
    case 'private':
      return 'Private'
    case 'confidential':
      return 'Confidential'
  }
}

export default function SelectVisibilityTransparency(props: IProps) {
  const visiblityOptions: Visibility[] = ['default', 'public', 'private']
  const transparencyOptions: Transparency[] = ['opaque', 'transparent']

  return (
    <Flex>
      <Menu>
        <MenuButton as={Button} variant="ghost" rightIcon={<FiChevronDown />} fontWeight={'normal'}>
          {freeBusyText(props.transparency)}
        </MenuButton>

        <MenuList>
          {transparencyOptions.map((transparency, idx) => (
            <MenuItem
              fontSize="sm"
              key={idx}
              onClick={() => {
                props.onTransparencyChange(transparency)
              }}
            >
              <span>{freeBusyText(transparency)}</span>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>

      <Menu>
        <MenuButton as={Button} variant="ghost" rightIcon={<FiChevronDown />} fontWeight={'normal'}>
          {visibilityText(props.visibility)}
        </MenuButton>

        <MenuList>
          {visiblityOptions.map((visibility, idx) => (
            <MenuItem
              fontSize="sm"
              key={idx}
              onClick={() => {
                props.onVisibilityChange(visibility)
              }}
            >
              <span>{visibilityText(visibility)}</span>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </Flex>
  )
}
