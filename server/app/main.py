import os
import uvicorn
from fastapi import FastAPI
from starlette.requests import Request
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.core import config
from app.api.router import api_router
from app.db.session import AsyncSession

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
async def db_session_middleware(request: Request, call_next):
    async with AsyncSession() as asyncSession:
        request.state.db = asyncSession
        response = await call_next(request)
        await request.state.db.close()

    return response


def start():
    """launch with poetry run start"""
    uvicorn.run('app.main:app', host='0.0.0.0', port=8080, reload=True)
