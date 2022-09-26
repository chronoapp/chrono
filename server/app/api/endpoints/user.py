from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.utils.security import get_current_user


router = APIRouter()


class UserModel(BaseModel):
    email: str
    timezone: str

    class Config:
        orm_mode = True


@router.get('/user/', response_model=UserModel)
async def getUser(user=Depends(get_current_user)):
    return user
