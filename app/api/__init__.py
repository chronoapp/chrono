import os
from sanic import Sanic
from sanic import response
import logging
sanicApp = Sanic(__name__)

from .views import *

if __name__ == '__main__':
    sanicApp.run(
        host='0.0.0.0',
        debug=True,
        log_config=logging.DEBUG,
        workers=1,
        port=80)
