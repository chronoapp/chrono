import uuid as uuid_lib
from typing import Literal, Optional, TYPE_CHECKING

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base

if TYPE_CHECKING:
    from .calendar import Calendar


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

    uuid: Mapped[uuid_lib.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid_lib.uuid4
    )

    google_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    calendar_id = mapped_column(String, ForeignKey('calendar.id'), nullable=True)
    calendar: Mapped['Calendar'] = relationship('Calendar', back_populates='access_control_rules')

    role: Mapped[Optional[str]] = mapped_column(String(50))  # AccessRole
    scope_type: Mapped[Optional[str]] = mapped_column(String(50))  # ScopeType
    scope_value: Mapped[Optional[str]] = mapped_column(String)

    def __init__(
        self,
        google_id: str,
        role: AccessRole,
        scope_type: ScopeType,
        scope_value: str,
    ):
        self.google_id = google_id
        self.role = role
        self.scope_type = scope_type
        self.scope_value = scope_value

    def __repr__(self) -> str:
        return f'<AccessControlRule id={self.uuid} role={self.role} type={self.scope_type} value={self.scope_value}/>'
