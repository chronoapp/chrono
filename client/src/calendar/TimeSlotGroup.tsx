import { ZonedDateTime as DateTime } from '@js-joda/core'

/**
 * Displays lines between one hour chunks.
 */
function TimeSlotGroup(props: { group: DateTime[] }) {
  return (
    <div className="cal-timeslot-group">
      {props.group.map((val, idx) => {
        return <div key={idx} className="cal-time-slot" />
      })}
    </div>
  )
}

export default TimeSlotGroup
