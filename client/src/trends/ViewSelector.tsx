import clsx from 'clsx'
import { Box } from '@chakra-ui/react'
import { FiBarChart2, FiGrid } from 'react-icons/fi'

export type TrendView = 'CHART' | 'HABIT_GRAPH'

interface IProps {
  selectedView: TrendView
  setSelectedView: (view: TrendView) => void
}

function ViewSelector(props: IProps) {
  return (
    <Box mr="2">
      <button
        onClick={() => props.setSelectedView('CHART')}
        className={clsx(
          'button',
          'button-invert-active',
          'is-small',
          'has-text-grey',
          props.selectedView === 'CHART' && 'is-active'
        )}
      >
        <FiBarChart2 size={'1.25em'} />
      </button>
      <button
        onClick={() => props.setSelectedView('HABIT_GRAPH')}
        className={clsx(
          'button',
          'button-invert-active',
          'ml-1',
          'is-small',
          'has-text-grey',
          props.selectedView === 'HABIT_GRAPH' && 'is-active'
        )}
      >
        <FiGrid size={'1.25em'} />
      </button>
    </Box>
  )
}

export default ViewSelector
