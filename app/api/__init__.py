import os
from sanic import Sanic
from sanic import response

sanicApp = Sanic(__name__)

from .views import *

if __name__ == '__main__':
    sanicApp.run(
        host='0.0.0.0',
        debug=True,
        workers=1,
        port=80)
