import logging


class BaseConfig(object):
    VERSION = '1.0'
    DEBUG = False
    BCRYPT_LOG_ROUNDS = 13
    WTF_CSRF_ENABLED = True
    DEBUG_TB_ENABLED = False
    DEBUG_TB_INTERCEPT_REDIRECTS = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LOG_LEVEL = logging.INFO

    GOOG_CLIENT_ID = '836759072617-pgtfcimhgkskl9geq9570h2gm9aqplkk.apps.googleusercontent.com'
    GOOG_CLIENT_SECRET = 'Q6NTZ7ABo3cELntZxMi2hR7a'


class DevelopmentConfig(BaseConfig):
    """Development configuration."""
    DEBUG = True
