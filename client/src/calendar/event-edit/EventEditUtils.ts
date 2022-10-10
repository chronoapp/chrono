import Calendar from '@/models/Calendar'
import EventParticipant from '@/models/EventParticipant'

/**
 * Adds new participants to the existing participant list.
 *
 * Conditions:
 * - If a contact is already in the list, it is not added.
 * - If this is the first contact, we add the current user as the organizer.
 *
 */
export function mergeParticipants(
  calendar: Calendar,
  participants: EventParticipant[],
  newParticipants: EventParticipant[]
) {
  let updatedParticipants = [...participants]

  if (participants.length == 0) {
    const organizer = EventParticipant.fromCreatorOrOrganizer(calendar.email, calendar.summary)
    updatedParticipants = [...updatedParticipants, organizer]
  }

  const dedupedNewParticipants = newParticipants.filter(
    (newParticipant) => !updatedParticipants.find((p) => p.equals(newParticipant))
  )

  return [...updatedParticipants, ...dedupedNewParticipants]
}
