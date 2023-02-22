from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship, backref, Mapped, mapped_column

from app.db.base_class import Base

if TYPE_CHECKING:
    from .user import User
    from .label import Label


class LabelRule(Base):
    """Rule to always add a Label to the event when the title is {LabelRule.text}
    when the calendar syncs.
    """

    __tablename__ = 'label_rule'
    id = mapped_column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    text = mapped_column(String(255), nullable=False)

    user_id = mapped_column(Integer, ForeignKey('user.id'), nullable=False)
    user: Mapped['User'] = relationship(
        'User', backref=backref('label_rules', lazy='dynamic', cascade='all,delete')
    )

    label_id = mapped_column(Integer, ForeignKey('label.id'), nullable=False)
    label: Mapped['Label'] = relationship('Label', back_populates='rules')

    def __init__(self, text: str):
        self.text = text

    def __repr__(self) -> str:
        return f'<LabelRule {self.text} {self.label.title}>'
