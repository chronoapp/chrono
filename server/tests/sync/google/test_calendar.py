import pytest
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.models import User, Event, Calendar, UserCalendar
from app.sync.google.calendar import (
    syncEventsToDb,
    syncCreatedOrUpdatedGoogleEvent,
)
from app.api.repos.event_utils import getRecurringEventId
from app.api.repos.event_repo import EventRepository, getBaseEventsStmt

EVENT_ITEM_RECURRING = {
    'kind': 'calendar#event',
    'etag': '"3214969133292000"',
    'id': '02kan06ornak4vngjaeem1rjhl',
    'status': 'confirmed',
    'created': '2020-12-09T03:29:26.000Z',
    'updated': '2020-12-09T03:29:26.646Z',
    'summary': 'Test Recur',
    'creator': {'email': 'test-email@example.com', 'self': True},
    'organizer': {'email': 'test-email@example.com', 'self': True},
    'start': {'dateTime': '2020-12-09T11:00:00-05:00', 'timeZone': 'America/Toronto'},
    'end': {'dateTime': '2020-12-09T12:00:00-05:00', 'timeZone': 'America/Toronto'},
    'recurrence': ['RRULE:FREQ=DAILY;COUNT=5'],
    'sequence': 0,
    'reminders': {'useDefault': True},
}


def getRecurringEventItem(eventItem, datetime: datetime):
    """Creates an overidden instance of a recurring event."""
    eventItem = eventItem.copy()
    originalId = eventItem['id']

    eventItem['id'] = getRecurringEventId(originalId, datetime, False)
    eventItem['summary'] = eventItem['summary'] + ' - override'
    eventItem['recurringEventId'] = originalId
    eventItem['originalStartTime'] = {
        'dateTime': datetime.isoformat(),
        'timeZone': 'America/Toronto',
    }
    eventItem['attendees'] = [
        {'email': 'test1@example.com', 'responseStatus': 'needsAction'},
        {'email': 'test2@example.com', 'responseStatus': 'needsAction'},
    ]
    del eventItem['recurrence']

    return eventItem


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_single(
    user, session: Session, eventRepo: EventRepository
):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    event = await syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)
    await session.commit()

    assert event.title == eventItem.get('summary')
    assert event.g_id == eventItem.get('id')
    assert event.creator.email == 'test-email@example.com'

    events = await eventRepo.getSingleEvents(user, calendar.id)
    assert len(events) == 1


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_single_with_attendees(user, session, eventRepo):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    # Add participants
    eventItem['attendees'] = [
        {'email': 'test@example.com', 'self': True, 'displayName': 'My Name'},
        {'email': 'test2@example.com'},
    ]

    event = await syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)

    await session.commit()

    assert len(event.participants) == 2


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_recurring(user, session, eventRepo):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    event = await syncCreatedOrUpdatedGoogleEvent(
        calendar, eventRepo, None, EVENT_ITEM_RECURRING, session
    )
    await session.commit()

    assert event.g_id == EVENT_ITEM_RECURRING.get('id')

    eventRepo = EventRepository(session)
    events = await eventRepo.getRecurringEvents(
        user, calendar.id, datetime.fromisoformat('2021-01-01')
    )

    assert len(events) == 1

    stmt = select(func.count()).where(Event.recurrences == None)
    nonRecurringCount = (await session.execute(stmt)).scalar()
    assert nonRecurringCount == 0


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_allDay(user, session, eventRepo):
    eventItem = {
        'id': '20201225_60o30chp64o30c1g60o30dr56g',
        'status': 'confirmed',
        'created': '2019-09-18T22:47:44.000Z',
        'updated': '2019-09-18T22:47:44.000Z',
        'summary': 'Christmas Day',
        'start': {'date': '2020-12-25'},
        'end': {'date': '2020-12-26'},
        'transparency': 'transparent',
        'visibility': 'public',
    }

    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    event = await syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)

    assert event.all_day
    assert event.start_day == '2020-12-25'
    assert event.end_day == '2020-12-26'
    assert event.start == datetime.fromisoformat('2020-12-25T00:00:00')
    assert event.end == datetime.fromisoformat('2020-12-26T00:00:00')


@pytest.mark.asyncio
async def test_syncEventsToDb_deleted(user, session: Session):
    """TODO: Ensures that all child events are deleted when the parent
    recurring event is deleted.
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    await syncEventsToDb(calendar, [EVENT_ITEM_RECURRING], session)
    await session.commit()

    eventRepo = EventRepository(session)
    events = await eventRepo.getRecurringEvents(
        user, calendar.id, datetime.fromisoformat('2021-01-01')
    )

    assert len(events) == 1
    assert events[0].status == 'active'

    # Remove the event.
    eventItem = EVENT_ITEM_RECURRING.copy()
    eventItem['status'] = 'cancelled'

    await syncEventsToDb(calendar, [eventItem], session)
    await session.commit()

    events = await eventRepo.getRecurringEvents(
        user, calendar.id, datetime.fromisoformat('2021-01-01')
    )
    assert len(events) == 0


@pytest.mark.asyncio
async def test_syncEventsToDb_recurring(user, session: Session):
    """Event from 11:00-11:30pm: at 01-09, (EXCLUDE 01-10), 01-11, 01-12
    - UPDATE event's time at 01-10 -> 10-11
    - DELETE event at 01-12
    Result: [Event: 01-09, Event: 01-11 (updated)]
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    eventItems = [
        {
            "id": "7bpp8ujgsitkcuk6h1er0nadfn",
            "status": "confirmed",
            "summary": "recurring-event",
            "start": {"dateTime": "2021-01-09T23:00:00-05:00", "timeZone": "America/Toronto"},
            "end": {"dateTime": "2021-01-09T23:30:00-05:00", "timeZone": "America/Toronto"},
            "recurrence": [
                "EXDATE;TZID=America/Toronto:20210111T230000",
                "RRULE:FREQ=DAILY;UNTIL=20210113T045959Z",
            ],
        },
        {
            "id": "7bpp8ujgsitkcuk6h1er0nadfn_20210111T040000Z",
            "status": "confirmed",
            "summary": "recurring-event",
            "start": {"dateTime": "2021-01-11T09:15:00-05:00"},
            "end": {"dateTime": "2021-01-11T09:45:00-05:00"},
            "recurringEventId": "7bpp8ujgsitkcuk6h1er0nadfn",
            "originalStartTime": {"dateTime": "2021-01-10T23:00:00-05:00"},
        },
        {
            "id": "7bpp8ujgsitkcuk6h1er0nadfn_20210113T040000Z",
            "status": "cancelled",
            "recurringEventId": "7bpp8ujgsitkcuk6h1er0nadfn",
            "originalStartTime": {"dateTime": "2021-01-12T23:00:00-05:00"},
        },
    ]

    await syncEventsToDb(calendar, eventItems, session)
    await session.commit()

    parent = (
        await session.execute(select(Event).where(Event.g_id == '7bpp8ujgsitkcuk6h1er0nadfn'))
    ).scalar()

    events = (await session.execute(user.getSingleEventsStmt(showDeleted=True))).scalars().all()
    assert len(events) == 2

    for e in events:
        assert e.recurring_event_id == parent.id
        assert e.recurring_event_calendar_id == parent.calendar_id


@pytest.mark.asyncio
async def test_syncEventsToDb_recurring_withParticipants(user, session):
    """Make sure participants are created."""
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Add the parent event

    eventItemParent = EVENT_ITEM_RECURRING.copy()
    eventItemParent['id'] = 'abcabc'
    eventItemParent['attendees'] = [
        {'email': 'test1@example.com', 'responseStatus': 'needsAction'},
        {'email': 'test2@example.com', 'responseStatus': 'needsAction'},
    ]

    # Add the recurring event instance

    eventItem = getRecurringEventItem(
        eventItemParent, datetime.fromisoformat('2020-12-11T11:00:00-05:00')
    )

    await syncEventsToDb(calendar, [eventItem, eventItemParent], session)

    eventRepo = EventRepository(session)
    events = await eventRepo.getSingleEvents(user, calendar.id)

    result = await session.execute(user.getSingleEventsStmt(showRecurring=True))
    events = result.scalars().all()

    assert len(events) == 1

    recurringEventInstance = events[0]

    assert recurringEventInstance.g_id == eventItem['id']
    assert len(recurringEventInstance.participants) == 2

    participantEmails = {p.email for p in recurringEventInstance.participants}

    assert 'test1@example.com' in participantEmails
    assert 'test2@example.com' in participantEmails


@pytest.mark.asyncio
async def test_syncEventsToDb_duplicateEventMultipleCalendars(user: User, session: Session):
    """Add the same event to multiple calendar.
    It should be duplicated and exist in each calendar.
    """
    # Original Calendar
    myCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Add another calendar
    readOnlyCalendar = UserCalendar(
        'calendar-id-2',
        None,
        '#ffffff',
        '#000000',
        True,
        'owner',
        True,
        False,
    )
    readOnlyCalendar.calendar = Calendar(
        'calendar-id-2', 'Another calendar', 'description', 'America/Toronto', 'test@example.com'
    )
    user.calendars.append(readOnlyCalendar)

    # Create events in both calendar
    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    await syncEventsToDb(readOnlyCalendar, [eventItem], session)
    await syncEventsToDb(myCalendar, [eventItem], session)

    stmt = getBaseEventsStmt().where(User.id == user.id, Calendar.id == readOnlyCalendar.id)
    result = await session.execute(stmt)
    cal1Events = result.scalars().all()

    assert len(cal1Events) == 1

    stmt = getBaseEventsStmt().where(User.id == user.id, Calendar.id == myCalendar.id)
    result = await session.execute(stmt)
    cal2Events = result.scalars().all()

    assert len(cal2Events) == 1
    assert cal1Events[0].g_id == cal2Events[0].g_id


@pytest.mark.asyncio
async def test_syncEventsToDb_changedRecurringEvent(user: User, session: Session):
    """Sync a google event where:
    - Event id is the same, but the recurring event has changed.
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    parentEvent = EVENT_ITEM_RECURRING.copy()
    recurringEvent = getRecurringEventItem(
        parentEvent, datetime.fromisoformat('2020-07-12T10:30:00-05:00')
    )

    await syncEventsToDb(calendar, [parentEvent, recurringEvent], session)

    stmt = getBaseEventsStmt().where(User.id == user.id, Calendar.id == calendar.id)
    result = await session.execute(stmt)
    calEvents = result.scalars().all()
    assert len(calEvents) == 2

    # Sync the event again. The Event ID is the same, but base recurring event has changed.

    parentEvent2 = parentEvent.copy()
    parentEvent2['id'] = 'different-id'

    recurringEvent2 = getRecurringEventItem(
        parentEvent2, datetime.fromisoformat('2020-07-12T10:30:00-05:00')
    )
    recurringEvent2['id'] = recurringEvent['id']

    await syncEventsToDb(calendar, [recurringEvent2, parentEvent2], session)

    stmt = getBaseEventsStmt().where(User.id == user.id, Calendar.id == calendar.id)
    result = await session.execute(stmt)
    calEvents = result.scalars().all()

    googleEventIds = set(e.g_id for e in calEvents)
    assert recurringEvent2['id'] in googleEventIds
    assert parentEvent2['id'] in googleEventIds
