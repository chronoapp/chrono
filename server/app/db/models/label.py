import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, ForeignKey, UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.db.base_class import Base

DEFAULT_TAG_COLOR = '#cecece'

if TYPE_CHECKING:
    from .user import User
    from .label_rule import LabelRule


class Label(Base):
    __tablename__ = 'label'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, nullable=False, default=uuid.uuid4
    )

    parent: Mapped['Label'] = relationship('Label', remote_side=[id])
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID, ForeignKey('label.id'), nullable=True
    )

    user_id = mapped_column(UUID, ForeignKey('user.id'), nullable=False)
    user: Mapped['User'] = relationship('User', back_populates='labels')

    title = mapped_column(String(255))
    key = mapped_column(String(50), index=True)
    color_hex = mapped_column(String(50), nullable=False)

    # Position within parent node.
    position = mapped_column(Integer, default=0)

    rules: Mapped[list['LabelRule']] = relationship(
        'LabelRule', back_populates='label', lazy='dynamic', cascade='all,delete'
    )

    def __init__(self, title: str, color_hex: str = DEFAULT_TAG_COLOR) -> None:
        self.title = title
        self.color_hex = color_hex
        self.position = 0

    def __repr__(self) -> str:
        return f'<Label {self.id} {self.parent_id=} {self.title=} {self.position=}/>'
