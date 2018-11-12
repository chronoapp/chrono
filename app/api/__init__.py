import os
from sanic import Sanic
from sanic import response
from sanic_cors import CORS
import logging

sanicApp = Sanic(__name__)
sanicApp.config['CORS_AUTOMATIC_OPTIONS'] = True
CORS(sanicApp)

from .views import *

if __name__ == '__main__':
    sanicApp.run(
        host='0.0.0.0',
        debug=True,
        log_config=logging.DEBUG,
        workers=1,
        port=80)
