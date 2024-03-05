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
        height: '100%',
        width: '4px',
        backgroundColor: backgroundColor,
        borderTopLeftRadius: '10px',
        borderBottomLeftRadius: '10px',
      }}
    ></Box>
  )
}
