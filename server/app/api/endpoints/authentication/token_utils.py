import jwt
from datetime import datetime

from app.core import config
from app.db.models.user import User


def getAuthToken(user: User) -> str:
    """Encodes a JWT token.
    TODO: add expiration date to token. {"exp": expire}
    """

    return str(
        jwt.encode(
            {'user_id': user.id, 'iat': datetime.utcnow()}, config.TOKEN_SECRET, algorithm='HS256'
        )
    )
