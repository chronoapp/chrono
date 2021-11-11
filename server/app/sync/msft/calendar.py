import logging
import time

from requests_oauthlib import OAuth2Session
from app.core import config
from app.db.models import UserCredential

MSFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0'


def getMsftSettings():
    return {
        'app_id': config.MSFT_APP_ID,
        'app_secret': config.MSFT_APP_SECRET,
        'redirect': "http://localhost:8888/api/v1/oauth/msft/callback",
        'scopes': 'profile openid User.Read Calendars.Read Calendars.ReadWrite',
        'authority': "https://login.microsoftonline.com/common",
        'authorize_endpoint': "/oauth2/v2.0/authorize",
        'token_endpoint': "/oauth2/v2.0/token",
    }


def getOrRefreshToken(creds: UserCredential):
    token = creds.token_data
    if token != None:
        # Check expiration
        now = time.time()
        # Subtract 5 minutes from expiration to account for clock skew
        expire_time = token['expires_at'] - 300
        if now >= expire_time:
            settings = getMsftSettings()
            # Refresh the token
            session = OAuth2Session(settings['app_id'],
                                    token=token,
                                    scope=settings['scopes'],
                                    redirect_uri=settings['redirect'])

            refresh_params = {
                'client_id': settings['app_id'],
                'client_secret': settings['app_secret'],
            }
            tokenUrl = '{0}{1}'.format(settings['authority'], settings['token_endpoint'])
            newToken = session.refresh_token(tokenUrl, **refresh_params)

            # Save new token
            creds.token_data = newToken

            # Return new access token
            return newToken

        else:
            # Token still valid, just return it
            return token


def getMsftUser(token):
    client = OAuth2Session(token=token)
    user = client.get('{0}/me'.format(MSFT_GRAPH_URL))
    return user.json()


def getCalendarEvents(token):
    graph_client = OAuth2Session(token=token)

    # Configure query parameters to
    # modify the results
    query_params = {'$select': 'subject,organizer,start,end', '$orderby': 'createdDateTime DESC'}

    # Send GET to /me/events
    events = graph_client.get('{0}/me/events'.format(MSFT_GRAPH_URL), params=query_params)

    # Return the JSON result
    return events.json()
