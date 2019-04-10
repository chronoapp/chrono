from fastapi import APIRouter

from app.api.endpoints import healthcheck

api_router = APIRouter()
api_router.include_router(healthcheck.router)

