
import os

PROJECT_ID = 'timecouncil'
API_V1_STR = "/api/v1"

APP_URL = 'http://localhost:3000'
API_URL = 'https://test.timecouncil.com'
GOOGLE_CLIENT_ID = '77797678955-052bf8kfcjblu9tf5ni8lk6ufp7dceap.apps.googleusercontent.com'
GOOGLE_CLIENT_SECRET = 'iAH7T1el2c8Z_Q6H6qsnIcDJ'
TOKEN_SECRET = 'Od94eZnNSZS2VO6xQtTiBET6aY8avvlR'

DEBUG = os.environ.get('DEBUG', True)
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
