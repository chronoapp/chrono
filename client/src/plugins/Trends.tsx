import React, { useState, useContext } from 'react'
import dynamic from 'next/dynamic'

import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import { TrendView } from '@/trends/ViewSelector'
import { Label } from '@/models/Label'

const TrendChart = dynamic(() => import('@/trends/TrendChart'), { ssr: false })
const HabitGraph = dynamic(() => import('@/trends/HabitGraph'), { ssr: false })

interface IProps {
  authToken: string
}

function Trends(props: IProps) {
  const [selectedView, setSelectedView] = useState<TrendView>('CHART')
  const { labelState } = useContext<LabelContextType>(LabelContext)
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
        authToken={props.authToken}
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
    throw Error("Invalid View")
  }
}

export default Trends
