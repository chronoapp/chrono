from uuid import UUID
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from pydantic import BaseModel, ConfigDict

from app.utils.flags import FlagUtils, FlagType
from app.api.utils.security import get_current_user
from app.api.utils.db import get_db

from app.db.repos.calendar_repo import CalendarRepository

from app.db.models.user_account import CalendarProvider
from app.db.models.user import User


router = APIRouter()


class AccountVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: CalendarProvider
    email: str
    is_default: bool


class ZoomConnectionVM(BaseModel):
    email: str


class UserVM(BaseModel):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    id: UUID
    flags: dict[FlagType, bool] | None
    email: str
    timezones: list[str]
    picture_url: str | None = None
    name: str | None = None
    username: str | None = None
    default_calendar_id: UUID | None = None
    accounts: list[AccountVM]
    zoom_connection: ZoomConnectionVM | None = None


class UpdateUserVM(BaseModel):
    timezones: list[str]
    name: str | None = None
    username: str | None = None
    default_calendar_id: UUID | None = None


@router.get('/user/', response_model=UserVM)
async def getUser(user=Depends(get_current_user)):
    return _userToVM(user)


@router.put('/user/', response_model=UserVM)
async def updateUser(
    userVM: UpdateUserVM, user: User = Depends(get_current_user), session=Depends(get_db)
):
    user.timezones = userVM.timezones
    user.name = userVM.name
    user.username = userVM.username

    if userVM.default_calendar_id:
        # Makes sure the calendar exists
        calendarRepo = CalendarRepository(session)
        calendar = calendarRepo.getCalendar(user, userVM.default_calendar_id)
        user.default_calendar_id = calendar.id
    else:
        user.default_calendar_id = None

    session.add(user)
    session.commit()

    return _userToVM(user)


@router.get('/user/flags/', response_model=dict[FlagType, bool])
async def getUserFlags(user: User = Depends(get_current_user)):
    return FlagUtils(user).getAllFlags()


@router.put('/user/flags/', response_model=dict[FlagType, bool])
async def setUserFlags(flags: dict[FlagType, bool], user: User = Depends(get_current_user)):
    return FlagUtils(user).setAllFlags(flags)


@router.delete('/user/accounts/{account_id}')
async def deleteUserAccount(
    account_id: UUID, user: User = Depends(get_current_user), session=Depends(get_db)
):
    account = next((a for a in user.accounts if a.id == account_id), None)
    if not account:
        return JSONResponse({"error": "Account not found"}, status_code=status.HTTP_404_NOT_FOUND)

    session.delete(account)
    session.commit()

    return JSONResponse({}, status_code=status.HTTP_200_OK)


@router.delete('/user/zoom-connection/')
async def deleteUserZoomConnection(user: User = Depends(get_current_user), session=Depends(get_db)):
    """Deletes the user's zoom connection."""
    if not user.zoom_connection:
        return JSONResponse(
            {"error": "Zoom connection not found"}, status_code=status.HTTP_404_NOT_FOUND
        )

    session.delete(user.zoom_connection)
    session.commit()

    return JSONResponse({}, status_code=status.HTTP_200_OK)


def _userToVM(user: User):
    return UserVM(
        id=user.id,
        default_calendar_id=user.default_calendar_id,
        flags=FlagUtils(user).getAllFlags(),
        email=user.email,
        timezones=user.timezones or [],
        picture_url=user.picture_url,
        name=user.name,
        username=user.username,
        accounts=(
            [
                AccountVM(
                    id=account.id,
                    provider=CalendarProvider(account.provider),
                    email=account.email,
                    is_default=account.is_default,
                )
                for account in user.accounts
            ]
            if user.accounts
            else []
        ),
        zoom_connection=(
            ZoomConnectionVM(email=user.zoom_connection.email) if user.zoom_connection else None
        ),
    )
