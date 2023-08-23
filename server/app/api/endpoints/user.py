from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.api.utils.security import get_current_user


router = APIRouter()


class UserModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    timezone: str


@router.get('/user/', response_model=UserModel)
async def getUser(user=Depends(get_current_user)):
    return user
