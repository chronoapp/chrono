from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db

from app.db.models.user import User
from app.utils.zoom import ZoomAPI, ZoomMeetingInput, ZoomMeetingDetail

router = APIRouter()


@router.post(
    '/conferencing/zoom', response_model=ZoomMeetingDetail, status_code=status.HTTP_201_CREATED
)
def createZoomMeeting(
    meeting: ZoomMeetingInput, user: User = Depends(get_current_user), session=Depends(get_db)
):

    if not user.zoom_connection:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, content={"message": "No Zoom connection"}
        )

    zoomAPI = ZoomAPI(session, user.zoom_connection)
    created = zoomAPI.createMeeting(meeting)

    return created


@router.delete('/conferencing/zoom/{meetingId}')
def deleteZoomMeeting(
    meetingId: int, user: User = Depends(get_current_user), session=Depends(get_db)
):
    if not user.zoom_connection:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, content={"message": "No Zoom connection"}
        )

    try:
        zoomAPI = ZoomAPI(session, user.zoom_connection)
        zoomAPI.deleteMeeting(meetingId)
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, content={"message": "Failed to delete meeting"}
        )

    return JSONResponse({}, status_code=status.HTTP_200_OK)
