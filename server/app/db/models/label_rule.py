from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base


class LabelRule(Base):
    """Rule to always add a Label to the event when the title is {LabelRule.text}
    when the calendar syncs.
    """

    __tablename__ = 'label_rule'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    text = Column(String(255), nullable=False)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship(
        'User', backref=backref('label_rules', lazy='dynamic', cascade='all,delete')
    )

    label_id = Column(Integer, ForeignKey('label.id'), nullable=False)
    label = relationship('Label', backref=backref('rules', lazy='dynamic', cascade='all,delete'))

    def __init__(self, text: str):
        self.text = text

    def __repr__(self) -> str:
        return f'<LabelRule {self.text} {self.label.title}>'
