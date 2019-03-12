import os

from flask import Flask
from flask_cors import CORS

import logging

flaskApp = Flask(__name__)
flaskApp.config['CORS_AUTOMATIC_OPTIONS'] = True
CORS(flaskApp)


from .views import *

if __name__ == '__main__':
    flaskApp.run(
        host='0.0.0.0',
        debug=True,
        log_config=logging.DEBUG,
        workers=1,
        port=80)
