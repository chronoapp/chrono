import clsx from 'clsx'
import { Box, Button } from '@chakra-ui/react'
import { FiBarChart2, FiGrid } from 'react-icons/fi'

export type TrendView = 'CHART' | 'HABIT_GRAPH'

interface IProps {
  selectedView: TrendView
  setSelectedView: (view: TrendView) => void
}

function ViewSelector(props: IProps) {
  return (
    <Box mr="2">
      <Button
        onClick={() => props.setSelectedView('CHART')}
        className={clsx('button-invert-active', props.selectedView === 'CHART' && 'is-active')}
      >
        <FiBarChart2 size={'1.25em'} />
      </Button>
      <Button
        ml="1"
        onClick={() => props.setSelectedView('HABIT_GRAPH')}
        className={clsx(
          'button-invert-active',
          props.selectedView === 'HABIT_GRAPH' && 'is-active'
        )}
      >
        <FiGrid size={'1.25em'} />
      </Button>
    </Box>
  )
}

export default ViewSelector
