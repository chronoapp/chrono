from fastapi import APIRouter

from app.api.endpoints import\
    healthcheck, authentication, trends, events, labels

api_router = APIRouter()
api_router.include_router(healthcheck.router)
api_router.include_router(authentication.router)
api_router.include_router(trends.router)
api_router.include_router(events.router)
api_router.include_router(labels.router)
