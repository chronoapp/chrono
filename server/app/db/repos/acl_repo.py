from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.access_control import AccessControlRule


class ACLRepository:
    def __init__(self, session: Session):
        self.session = session

    def getAccessControlRuleByGoogleId(self, googleId: str):
        """Gets the access control rule by google id."""
        return self.session.execute(
            select(AccessControlRule).where(AccessControlRule.google_id == googleId)
        ).scalar()

    def getAccessControlRules(self, calendarId: str):
        """Gets the access controls for the given calendar and email."""
        return self.session.execute(
            select(AccessControlRule).where(
                AccessControlRule.calendar_id == calendarId,
            )
        ).scalar()
