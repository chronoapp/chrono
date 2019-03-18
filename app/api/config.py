import logging
import os


class BaseConfig(object):
    VERSION = '1.0'
    DEBUG = False
    BCRYPT_LOG_ROUNDS = 13
    WTF_CSRF_ENABLED = True
    DEBUG_TB_ENABLED = False
    DEBUG_TB_INTERCEPT_REDIRECTS = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LOG_LEVEL = logging.INFO

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    CORS_AUTOMATIC_OPTIONS = True

    PROJECT_ID = 'timecouncil'
    APP_URL = 'http://localhost:3000'
    API_URL = 'https://test.timecouncil.com'
    GOOGLE_CLIENT_ID = '77797678955-052bf8kfcjblu9tf5ni8lk6ufp7dceap.apps.googleusercontent.com'
    GOOGLE_CLIENT_SECRET = 'iAH7T1el2c8Z_Q6H6qsnIcDJ'

    TOKEN_SECRET = 'Od94eZnNSZS2VO6xQtTiBET6aY8avvlR'


class DevelopmentConfig(BaseConfig):
    """Development configuration."""
    DEBUG = True
