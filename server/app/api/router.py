from fastapi import APIRouter

from app.api.endpoints import\
    healthcheck, authentication, trends, events, labels, label_rules

api_router = APIRouter()
api_router.include_router(healthcheck.router)
api_router.include_router(authentication.router)
api_router.include_router(trends.router)
api_router.include_router(events.router)
api_router.include_router(labels.router)
api_router.include_router(label_rules.router)
