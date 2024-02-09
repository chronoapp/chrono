import React from 'react'

import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
  Box,
} from '@chakra-ui/react'

interface IProps {
  onConfirm: () => Promise<any>
  onClose: () => void
  header: string
  body: string
  confirmText: string
  destructive?: boolean
}

function SettingsModal(props: IProps) {
  const initialFocusRef = React.useRef(null)
  const [isConfirming, setIsConfirming] = React.useState(false)

  return (
    <Modal
      size="sm"
      isOpen={true}
      onClose={props.onClose}
      blockScrollOnMount={false}
      initialFocusRef={initialFocusRef}
    >
      <ModalOverlay />
      <ModalContent top="20%">
        <ModalHeader pb="2" fontSize="md">
          {props.header}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Text fontSize="sm">{props.body}</Text>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="gray" variant="ghost" size="sm" mr={4} onClick={props.onClose}>
            Cancel
          </Button>
          <Box>
            <Button
              size="sm"
              onClick={async () => {
                setIsConfirming(true)
                await props.onConfirm()
                setIsConfirming(false)
              }}
              ref={initialFocusRef}
              borderRightRadius={0}
              colorScheme={props.destructive ? 'red' : 'primary'}
              isLoading={isConfirming}
            >
              {props.confirmText}
            </Button>
          </Box>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default SettingsModal
