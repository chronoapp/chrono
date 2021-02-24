import os
import uvicorn
from fastapi import FastAPI
from starlette.requests import Request
from starlette.middleware.cors import CORSMiddleware

from app.core import config
from app.api.router import api_router
from app.db.session import Session

app = FastAPI(title=config.PROJECT_ID, openapi_url="/api/v1/openapi.json")
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
    request.state.db = Session()
    response = await call_next(request)
    request.state.db.close()
    return response


def start():
    """launch with poetry run start"""
    uvicorn.run('app.main:app', host='0.0.0.0', port=80, reload=True, workers=2)
