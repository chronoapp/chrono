import os
import uvicorn
from fastapi import FastAPI
from starlette.requests import Request
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.core import config
from app.api.router import api_router
from app.db.session import scoped_session

# Register all tasks as part of this module.
from app.sync.google.tasks import *

app = FastAPI(
    title=config.PROJECT_ID,
    openapi_url="/api/v1/openapi.json",
    default_response_class=ORJSONResponse,
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
def db_session_middleware(request: Request, call_next):
    with scoped_session() as session:
        request.state.db = session
        response = call_next(request)

    return response


def start():
    """launch with poetry run start"""
    uvicorn.run('app.main:app', host='0.0.0.0', port=8080, reload=True)
