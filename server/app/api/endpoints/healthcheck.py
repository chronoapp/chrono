from fastapi import APIRouter

router = APIRouter()


@router.get('/')
async def healthcheck() -> dict:
    return {'data': 'ImATeapotShortAndStout'}
