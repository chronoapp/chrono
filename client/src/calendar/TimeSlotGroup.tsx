import React from 'react'

/**
 * Displays lines between one hour chunks.
 */
function TimeSlotGroup(props: { group: Date[] }) {
  return (
    <div className="cal-timeslot-group">
      {props.group.map((val, idx) => {
        return <div key={idx} className="cal-time-slot" />
      })}
    </div>
  )
}

export default TimeSlotGroup
