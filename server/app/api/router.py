from fastapi import APIRouter

from app.api.endpoints import (
    healthcheck,
    authentication,
    events,
    labels,
    label_rules,
    sync,
    calendars,
    webhooks,
    contacts,
    user,
    plugins,
    websockets,
)

api_router = APIRouter()
api_router.include_router(healthcheck.router)
api_router.include_router(authentication.router)
api_router.include_router(events.router)
api_router.include_router(labels.router)
api_router.include_router(label_rules.router)
api_router.include_router(sync.router)
api_router.include_router(calendars.router)
api_router.include_router(webhooks.router)
api_router.include_router(contacts.router)
api_router.include_router(user.router)
api_router.include_router(plugins.router)
api_router.include_router(websockets.router)
