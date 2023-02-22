from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship, backref, Mapped, mapped_column
from sqlalchemy.ext.orderinglist import ordering_list

from app.db.base_class import Base

DEFAULT_TAG_COLOR = '#cecece'

if TYPE_CHECKING:
    from .user import User
    from .label_rule import LabelRule


class Label(Base):
    __tablename__ = 'label'

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, nullable=False
    )

    parent: Mapped['Label'] = relationship('Label', remote_side=[id])
    parent_id = mapped_column(BigInteger, ForeignKey('label.id'), nullable=True)

    user_id = mapped_column(Integer, ForeignKey('user.id'), nullable=False)
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
