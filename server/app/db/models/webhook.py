from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Webhook(Base):
    """Google webhook to track calendar updates
    """
    __tablename__ = 'webhook'
    id = Column(String, primary_key=True, nullable=False)

    calendar_id = Column(String(255), ForeignKey('calendar.id'), nullable=False)
    calendar = relationship('Calendar', back_populates='webhook')

    resource_id = Column(String())
    resource_uri = Column(String())

    def __repr__(self):
        return f'<Webhook {self.id} {self.calendar_id}>'

    def __init__(self, id: str, resourceId: str, resourceUri: str):
        self.id = id
        self.resource_id = resourceId
        self.resource_uri = resourceUri