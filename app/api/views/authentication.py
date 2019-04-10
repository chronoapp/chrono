import logging
import json
import jwt
import requests

from flask import jsonify, request, redirect
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from api import app
from api import db
from api.models import User, UserCredential


def getAuthFlow(scopes):
    credentials = {
        "web": {
            "client_id": app.config['GOOGLE_CLIENT_ID'],
            "project_id": app.config['PROJECT_ID'],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": app.config['GOOGLE_CLIENT_SECRET'],
            "redirect_uris": [
                "https://test.timecouncil.com/oauth/callback",
                "https://api.timecouncil.com/oauth/callback",
                'http://localhost:3000/auth'
            ],
            "javascript_origins": ["https://test.timecouncil.com"]
        }
    }
    flow = Flow.from_client_config(credentials, scopes=scopes)
    flow.redirect_uri = app.config['APP_URL'] + '/auth'

    return flow


@app.route('/oauth/google/auth', methods=['GET'])
def googleAuth():
    """Redirects to google oauth consent screen.
    https://developers.google.com/identity/protocols/OAuth2WebServer
    """
    scopes = [
        'https://www.googleapis.com/auth/calendar'
    ]
    flow = getAuthFlow(scopes)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true')

    return redirect(authorization_url)


@app.route('/oauth/google/token', methods=['POST'])
def googleAuthCallback():
    try:
        data = json.loads(request.data)
        authCode = data.get('code')

        flow = getAuthFlow(None)
        flow.fetch_token(code=authCode)

        token = flow.credentials.token
        resp = requests.get(f'https://www.googleapis.com/oauth2/v2/userinfo?access_token={token}')
        userInfo = resp.json()
        email = userInfo.get('email')
        name = userInfo.get('given_name')
        pictureUrl = userInfo.get('picture')
        logging.info(userInfo)

        user = User.query.filter(User.email == email).first()
        if not user:
            user = User(email, name, pictureUrl)
            db.session.add(user)
        else:
            user.email = email
            user.name = name
            user.picture_url = pictureUrl

        credentials = UserCredential(flow.credentials)
        user.credentials = credentials
        db.session.commit()

        authToken = jwt.encode({'token': token},
            app.config['TOKEN_SECRET'], algorithm='HS256').decode('utf-8')

        return jsonify({
            'token': str(authToken)
        })

    except Exception as e:
        logging.error(e)
