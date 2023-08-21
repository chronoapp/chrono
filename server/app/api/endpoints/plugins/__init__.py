from fastapi import APIRouter

from .people import router as peopleRouter
from .trends import router as trendsRouter

router = APIRouter()
router.include_router(peopleRouter)
router.include_router(trendsRouter)
