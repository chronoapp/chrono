import os

PROJECT_ID = 'timecouncil'
API_V1_STR = "/api/v1"

APP_URL = os.environ.get('APP_URL')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
TOKEN_SECRET = os.environ.get('TOKEN_SECRET', '')

DEBUG = os.environ.get('DEBUG', True)
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
