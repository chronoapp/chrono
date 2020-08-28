import React, { useState, useEffect, useContext } from 'react'
import ViewSelector, { TrendView } from './ViewSelector'

interface IProps {
  setSelectedView: (v: TrendView) => void
}

function HabitGraph(props: IProps) {
  const today = new Date()

  return (
    <div className="container mt-2">
      <div className="has-text-weight-semibold">
        <div className="level">
          <div className="level-left">Habit Chart</div>
          <ViewSelector setSelectedView={props.setSelectedView} selectedView={'HABIT_GRAPH'} />
        </div>
      </div>

      <div className="card-content"></div>
    </div>
  )
}

export default HabitGraph
