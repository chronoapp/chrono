from typing import Literal
from uuid import uuid4

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship, backref
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base


"""Reference: https://developers.google.com/calendar/api/v3/reference/acl"""

""""
The type of the scope. 

"default" - The public scope. This is the default value.
"user" - Limits the scope to a single user.
"group" - Limits the scope to a group.
"domain" - Limits the scope to a domain.
"""
ScopeType = Literal['default', 'user', 'group', 'domain']

"""
The role assigned to the scope.

"none" - Provides no access.
"freeBusyReader" - Provides read access to free/busy information.
"reader" - Provides read access to the calendar. Private events will appear to users with reader access, but event details will be hidden.
"writer" - Provides read and write access to the calendar. Private events will appear to users with writer access, and event details will be visible.
"owner" - Provides ownership of the calendar. This role has all of the permissions of the writer role AND can see and manipulate ACLs.
"""
AccessRole = Literal['freeBusyReader', 'reader', 'writer', 'owner']


class AccessControlRule(Base):
    __tablename__ = 'access_control_rule'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    google_id = Column(String, index=True)
    calendar_id = Column(String, ForeignKey('calendar.id'), nullable=True)
    calendar = relationship(
        'Calendar', backref=backref('access_control_rules', lazy='dynamic', cascade='all,delete')
    )
    role = Column(String(50))  # AccessRole

    scope_type = Column(String(50))  # ScopeType
    scope_value = Column(String)

    def __init__(
        self,
        google_id: str,
        calendar_id: str,
        role: AccessRole,
        scope_type: ScopeType,
        scope_value: str,
    ):
        self.google_id = google_id
        self.calendar_id = calendar_id
        self.role = role
        self.scope_type = scope_type
        self.scope_value = scope_value
