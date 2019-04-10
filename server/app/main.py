from fastapi import FastAPI
from pydantic import BaseModel, Schema

from app.core import config
from app.api.router import api_router

app = FastAPI(title=config.PROJECT_ID, openapi_url="/api/v1/openapi.json")
app.include_router(api_router, prefix=config.API_V1_STR)

