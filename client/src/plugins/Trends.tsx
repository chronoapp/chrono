import React, { useState } from 'react'
import { useRecoilValue } from 'recoil'

import { TrendView } from '@/trends/ViewSelector'
import { Label } from '@/models/Label'
import { labelsState } from '@/state/LabelsState'
import TrendChart from '@/trends/TrendChart'
import HabitGraph from '@/trends/HabitGraph'

function Trends() {
  const [selectedView, setSelectedView] = useState<TrendView>('CHART')
  const labelState = useRecoilValue(labelsState)

  const [selectedLabel, setSelectedLabel] = useState<Label | undefined>(getDefaultLabel())

  function getDefaultLabel() {
    const allLabels = Object.values(labelState.labelsById)
    return allLabels && allLabels.length > 0 ? allLabels[0] : undefined
  }

  if (selectedView === 'CHART') {
    return (
      <TrendChart
        selectedLabel={selectedLabel}
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        setSelectedView={setSelectedView}
      />
    )
  } else if (selectedView === 'HABIT_GRAPH') {
    return (
      <HabitGraph
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        selectedLabel={selectedLabel}
        setSelectedView={setSelectedView}
      />
    )
  } else {
    throw Error('Invalid View')
  }
}

export default Trends
