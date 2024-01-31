from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.utils.flags import FlagUtils, FlagType
from app.api.utils.security import get_current_user
from app.api.utils.db import get_db

from app.db.models.user_account import CalendarProvider
from app.db.models.user import User

router = APIRouter()


class AccountVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: CalendarProvider
    email: str


class UserVM(BaseModel):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    id: UUID
    flags: dict[FlagType, bool] | None
    email: str
    timezone: str
    picture_url: str | None = None
    name: str | None = None
    username: str | None = None
    accounts: list[AccountVM]


class UpdateUserVM(BaseModel):
    timezone: str
    name: str | None = None
    username: str | None = None


@router.get('/user/', response_model=UserVM)
async def getUser(user=Depends(get_current_user)):
    return _userToVM(user)


@router.put('/user/', response_model=UserVM)
async def updateUser(userVM: UpdateUserVM, user=Depends(get_current_user), session=Depends(get_db)):
    user.timezone = userVM.timezone
    user.name = userVM.name
    user.username = userVM.username

    from app.core.logger import logger

    logger.info(userVM)
    session.add(user)
    session.commit()

    return _userToVM(user)


@router.get('/user/flags/', response_model=dict[FlagType, bool])
async def getUserFlags(user=Depends(get_current_user)):
    return FlagUtils(user).getAllFlags()


@router.put('/user/flags/', response_model=dict[FlagType, bool])
async def setUserFlags(flags: dict[FlagType, bool], user=Depends(get_current_user)):
    return FlagUtils(user).setAllFlags(flags)


def _userToVM(user: User):
    return UserVM(
        id=user.id,
        flags=FlagUtils(user).getAllFlags(),
        email=user.email,
        timezone=user.timezone,
        picture_url=user.picture_url,
        name=user.name,
        username=user.username,
        accounts=[
            AccountVM(
                id=account.id,
                provider=CalendarProvider(account.provider),
                email=account.email,
            )
            for account in user.accounts
        ]
        if user.accounts
        else [],
    )
