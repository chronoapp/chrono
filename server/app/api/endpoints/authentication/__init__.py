from fastapi import APIRouter

# Import all sub routers
from .auth_google import router as googleRouter
from .auth_otp import router as otpRouter
from .auth_microsoft import router as msftRouter
from .auth_email import router as emailRouter
from .auth_zoom import router as zoomRouter

router = APIRouter()

router.include_router(otpRouter)
router.include_router(msftRouter)
router.include_router(googleRouter)
router.include_router(emailRouter)
router.include_router(zoomRouter)
