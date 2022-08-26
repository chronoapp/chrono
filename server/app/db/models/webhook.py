from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Webhook(Base):
    """Google webhook to track calendar updates"""

    __tablename__ = 'webhook'
    id = Column(String, primary_key=True, nullable=False)

    calendar_id = Column(String(255), ForeignKey('user_calendar.id'), nullable=False)
    calendar = relationship('UserCalendar', back_populates='webhook')

    resource_id = Column(String())
    resource_uri = Column(String())
    expiration = Column(DateTime(timezone=True), nullable=False)

    def __repr__(self):
        return f'<Webhook {self.id=} {self.calendar_id=} {self.expiration=}>'

    def __init__(self, id: str, resourceId: str, resourceUri: str, expirationTimestampMs: int):
        self.id = id
        self.resource_id = resourceId
        self.resource_uri = resourceUri
        self.expiration = datetime.fromtimestamp(expirationTimestampMs / 1000)
