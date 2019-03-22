import jwt
import logging

from flask import request, jsonify
from functools import wraps

from api import app
from api.models import UserCredential


def authorized(route):
    """Authenticates the user.
    """
    @wraps(route)
    def decorated_func(*args, **kwargs):
        authToken = request.headers.get('Authorization')

        if authToken:
            tokenData = jwt.decode(authToken, app.config['TOKEN_SECRET'], algorithm='HS256')
            accessToken = tokenData.get('token')

            credentials = UserCredential.query.filter(UserCredential.token == accessToken).first()
            if credentials:
                user = credentials.user
                if not user:
                    return jsonify({}, code=403)

                request.environ['user'] = user

        return route(*args, **kwargs)

    return decorated_func
