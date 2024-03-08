import { Box } from '@chakra-ui/react'

interface IndicatorColorProps {
  color: string
}

export function EventVerticalIndicator(props: IndicatorColorProps) {
  const { color } = props

  return (
    <Box
      style={{
        position: 'absolute',
        height: '100%',
        width: '4px',
        backgroundColor: color,
        borderTopLeftRadius: '10px',
        borderBottomLeftRadius: '10px',
      }}
    ></Box>
  )
}
