from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.orderinglist import ordering_list

from app.db.base_class import Base

DEFAULT_TAG_COLOR = '#cecece'

if TYPE_CHECKING:
    from .user import User
    from .label_rule import LabelRule


class Label(Base):
    __tablename__ = 'label'

    id: int = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)

    parent: 'Label' = relationship('Label', remote_side=[id])
    parent_id = Column(BigInteger, ForeignKey('label.id'), nullable=True)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user: 'User' = relationship(
        'User',
        backref=backref(
            'labels',
            lazy='joined',
            cascade='all,delete',
            order_by="Label.position",
            collection_class=ordering_list('position', count_from=0),
        ),
    )
    title = Column(String(255))
    key = Column(String(50), index=True)
    color_hex = Column(String(50), nullable=False)

    # Position within parent node.
    position = Column(Integer, default=0)
    rules: list['LabelRule']

    def __init__(self, title: str, color_hex: str = DEFAULT_TAG_COLOR) -> None:
        self.title = title
        self.color_hex = color_hex
        self.position = 0

    def __repr__(self) -> str:
        return f'<Label {self.id} {self.parent_id=} {self.title=} {self.position=}/>'
