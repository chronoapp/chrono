from typing import Any

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

import logging

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
app.config.from_object('api.config.DevelopmentConfig')
CORS(app)
db: Any = SQLAlchemy(app)
Migrate(app, db)

from api.views import *


@app.cli.command()
def get_data():
    logging.info('OK')
