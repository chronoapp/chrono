from sqlalchemy import Column, String, ForeignKey, Table, Integer
from app.db.base_class import Base


event_label_association_table = Table(
    'event_label',
    Base.metadata,
    Column('event_pk', String, ForeignKey('event.pk', ondelete='CASCADE')),
    Column('label_id', Integer, ForeignKey('label.id', ondelete='CASCADE')),
)
