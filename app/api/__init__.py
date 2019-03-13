import os

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

import logging

logging.basicConfig(level=logging.INFO)
flaskApp = Flask(__name__)
flaskApp.config.from_object('api.config.DevelopmentConfig')
CORS(flaskApp)
db = SQLAlchemy(flaskApp)
Migrate(flaskApp, db)

from .views import *

