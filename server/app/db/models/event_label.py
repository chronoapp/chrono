from sqlalchemy import Column, UUID, ForeignKey, Table, Integer
from app.db.base_class import Base


event_label_association_table = Table(
    'event_label',
    Base.metadata,
    Column('event_uid', UUID, ForeignKey('event.uid', ondelete='CASCADE')),
    Column('label_id', UUID, ForeignKey('label.id', ondelete='CASCADE')),
)
