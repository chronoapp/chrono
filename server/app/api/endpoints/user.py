from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.api.utils.security import get_current_user
from app.utils.flags import FlagUtils, FlagType

router = APIRouter()


class UserModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    flags: dict[FlagType, bool]
    email: str
    timezone: str


@router.get('/user/', response_model=UserModel)
async def getUser(user=Depends(get_current_user)):
    flags = FlagUtils(user).getAllFlags()

    return UserModel(flags=flags, email=user.email, timezone=user.timezone)


@router.get('/user/flags/', response_model=dict[FlagType, bool])
async def getUserFlags(user=Depends(get_current_user)):
    return FlagUtils(user).getAllFlags()


@router.put('/user/flags/', response_model=dict[FlagType, bool])
async def setUserFlags(flags: dict[FlagType, bool], user=Depends(get_current_user)):
    return FlagUtils(user).setAllFlags(flags)
