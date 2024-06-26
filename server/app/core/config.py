from typing import Optional, Literal
import os


API_V1_STR = "/api/v1"

APP_URL: str = os.environ['APP_URL']
BASE_API_URL: str = os.environ['API_URL']

API_URL = f'{BASE_API_URL}{API_V1_STR}'

GOOGLE_PROJECT_ID = os.environ.get('GOOGLE_PROJECT_ID')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

MSFT_APP_ID = os.environ.get('MSFT_APP_ID')
MSFT_APP_SECRET = os.environ.get('MSFT_APP_SECRET')

TOKEN_SECRET = os.environ.get('TOKEN_SECRET', '')

DEBUG = os.environ.get('DEBUG', True)
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')

if uri := os.environ.get('DATABASE_URL'):
    SQLALCHEMY_DATABASE_URI = uri.replace('postgres://', 'postgresql://')
else:
    raise Exception('Database URI not found.')

EMAIL_FROM_USER = 'Chrono <hello@chrono.so>'

POSTMARK_API_URL = 'https://api.postmarkapp.com/email'
POSTMARK_API_KEY = os.environ.get('POSTMARK_API_KEY')

MAILGUN_API_URL = os.environ.get('MAILGUN_API_URL')
MAILGUN_API_KEY = os.environ.get('MAILGUN_API_KEY')

EmailProviderType = Literal['mailgun', 'postmark']

EMAIL_PROVIDER: Optional[EmailProviderType]
if POSTMARK_API_URL and POSTMARK_API_KEY:
    EMAIL_PROVIDER = 'postmark'
elif MAILGUN_API_URL and MAILGUN_API_KEY:
    EMAIL_PROVIDER = 'mailgun'

LogLevel = Literal['debug', 'info', 'warning', 'error']
LOG_LEVEL: str = 'info'

ZOOM_CLIENT_ID = os.environ.get('ZOOM_CLIENT_ID')
ZOOM_CLIENT_SECRET = os.environ.get('ZOOM_CLIENT_SECRET')
