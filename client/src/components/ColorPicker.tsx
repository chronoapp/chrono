import React from 'react'
import { Flex, Box } from '@chakra-ui/react'
import { getSortedLabelColors } from '../models/LabelColors'

interface IProps {
  onSelectLabelColor: (color: string) => void
  innerRef?: React.Ref<HTMLDivElement>
}

function ColorPicker(props: IProps) {
  const colors = getSortedLabelColors().map((x) => x.hex)

  return (
    <div ref={props.innerRef} style={{ maxWidth: '12em' }}>
      <Box bg="white" p="2">
        <Flex>
          {colors.slice(0, colors.length / 2).map((color) => {
            return (
              <Box key={color} pl="1">
                <div
                  style={{ backgroundColor: color }}
                  onClick={() => props.onSelectLabelColor(color)}
                  className="event-label event-label--hoverable"
                ></div>
              </Box>
            )
          })}
        </Flex>
        <Flex mt="1">
          {colors.slice(6, colors.length).map((color) => {
            return (
              <Box key={color} pl="1">
                <div
                  style={{ backgroundColor: color }}
                  onClick={() => props.onSelectLabelColor(color)}
                  className="event-label event-label--hoverable"
                ></div>
              </Box>
            )
          })}
        </Flex>
      </Box>
    </div>
  )
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <ColorPicker {...props} innerRef={ref} />
))
