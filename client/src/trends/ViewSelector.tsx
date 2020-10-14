import clsx from 'clsx'
import { mdiPoll, mdiViewGrid } from '@mdi/js'
import Icon from '@mdi/react'

export type TrendView = 'CHART' | 'HABIT_GRAPH'

interface IProps {
  selectedView: TrendView
  setSelectedView: (view: TrendView) => void
}

function ViewSelector(props: IProps) {
  return (
    <div className="level-right mr-2">
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
        <Icon path={mdiPoll} size={1}></Icon>
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
        <Icon path={mdiViewGrid} size={1}></Icon>
      </button>
    </div>
  )
}

export default ViewSelector
