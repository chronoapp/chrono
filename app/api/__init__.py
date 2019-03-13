import os

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

import logging

flaskApp = Flask(__name__)
flaskApp.config['CORS_AUTOMATIC_OPTIONS'] = True
CORS(flaskApp)
db = SQLAlchemy(flaskApp)
Migrate(flaskApp, db)

from .views import *

if __name__ == '__main__':
    flaskApp.run(
        host='0.0.0.0',
        debug=True,
        log_config=logging.DEBUG,
        workers=1,
        port=80)
