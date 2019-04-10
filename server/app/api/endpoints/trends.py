from fastapi import APIRouter

router = APIRouter()


@router.get('/trends')
def getUserTrends():
    return {
        'labels': [],
        'values': []
    }
