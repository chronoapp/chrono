from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class User(Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    username = Column(String(255))

    email = Column(String(255))
    name = Column(String(255))
    picture_url = Column(String(255))

    google_oauth_state = Column(String(255), nullable=True)
    credentials = relationship('UserCredential',
                               cascade='save-update, merge, delete, delete-orphan',
                               uselist=False,
                               backref='user')

    def __init__(self, email, name, pictureUrl):
        self.email = email
        self.name = name
        self.picture_url = pictureUrl

    def getClassifierPath(self):
        return f'/var/lib/model_data/{self.username}.pkl'

    def syncWithGoogle(self) -> bool:
        # TODO: store sync settings
        return self.credentials and self.credentials.token
