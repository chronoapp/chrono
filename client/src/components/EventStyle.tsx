import { Box } from '@chakra-ui/react'

interface IndicatorColorProps {
  backgroundColor: string
}

export function EventVerticalIndicator(props: IndicatorColorProps) {
  const { backgroundColor } = props

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '6px',
        backgroundColor: backgroundColor,
        borderTopLeftRadius: '10px',
        borderBottomLeftRadius: '10px',
      }}
    ></Box>
  )
}
