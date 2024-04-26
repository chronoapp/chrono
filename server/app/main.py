import os
import uvicorn
import threading
from contextlib import asynccontextmanager


from starlette.requests import Request
from starlette.middleware.cors import CORSMiddleware

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.api.router import api_router
from app.db.session import scoped_session
from app.core.notifications import notification_listener
from app.core import config

# Register all tasks as part of this module.
from app.sync.google.tasks import *


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the notification listener in a separate thread.
    threading.Thread(target=notification_listener, daemon=True).start()
    yield


app = FastAPI(
    title='Chrono API',
    openapi_url="/api/v1/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    redirect_slashes=False,
)
app.include_router(api_router, prefix=config.API_V1_STR)

# TODO: Whitelist Origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1' if config.DEBUG else '0'


@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    response = None
    with scoped_session() as session:
        request.state.db = session
        response = await call_next(request)

    return response


def start():
    """launch with poetry run start"""
    uvicorn.run('app.main:app', host='0.0.0.0', port=8080, reload=True)
