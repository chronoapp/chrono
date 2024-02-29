import requests
from pydantic import BaseModel
from datetime import datetime
import base64

from sqlalchemy.orm import Session

from app.core.config import ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
from app.db.models import ZoomConnection


class ZoomMeetingInput(BaseModel):
    topic: str
    agenda: str
    start_time: str  # date in isoformat
    duration: int  # duration in minutes


class ZoomMeeting(BaseModel):
    uuid: str
    id: int
    host_id: str
    topic: str
    type: int
    start_time: datetime
    duration: int
    timezone: str
    created_at: datetime
    join_url: str


class ZoomMeetingDetail(ZoomMeeting):
    join_url: str
    password: str


class ZoomAPI:
    def __init__(self, session: Session, zoomConnection: ZoomConnection):
        self.session = session
        self.zoomConnection = zoomConnection
        self.baseUrl = "https://api.zoom.us/v2"

    def createMeeting(self, meeting: ZoomMeetingInput):
        url = f"{self.baseUrl}/users/me/meetings"

        jsonReq = meeting.model_dump()
        jsonReq['type'] = 2

        result = self._makeRequest(requests.post, url, jsonReq)

        return ZoomMeetingDetail(**result)

    def updateMeeting(self, meetingId: int, meeting: ZoomMeetingInput):
        url = f"{self.baseUrl}/meetings/{meetingId}"

        jsonReq = meeting.model_dump()

        return self._makeRequest(requests.patch, url, jsonReq)

    def deleteMeeting(self, meetingId: int):
        url = f"{self.baseUrl}/meetings/{meetingId}"

        return self._makeRequest(requests.delete, url, {})

    def getMeeting(self, meetingId: int) -> ZoomMeetingDetail:
        url = f"{self.baseUrl}/meetings/{meetingId}"

        result = self._makeRequest(requests.get, url, {})

        return ZoomMeetingDetail(**result)

    def getMeetings(self) -> list[ZoomMeeting]:
        url = f"{self.baseUrl}/users/me/meetings"

        resp = self._makeRequest(requests.get, url, {})
        meetings = resp['meetings']

        return [ZoomMeeting(**meeting) for meeting in meetings]

    def _makeRequest(self, method, url: str, json: dict, callDepth=0):
        if callDepth > 1:
            raise Exception("Failed to refresh token")

        resp = method(url, headers=self._getHeaders(), json=json)

        if resp.status_code == 401:
            self._refreshToken()
            return self._makeRequest(method, url, json, callDepth + 1)
        elif resp.status_code == 204:
            return {}
        elif resp.ok:
            return resp.json()
        else:
            raise Exception(f"Failed to make request: {resp.json()}")

    def _getHeaders(self):
        return {"Authorization": f"Bearer {self.zoomConnection.access_token}"}

    def _refreshToken(self):
        url = "https://zoom.us/oauth/token"

        credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
        encodedCreds = base64.b64encode(credentials.encode()).decode()

        headers = {'Authorization': 'Basic ' + encodedCreds}
        params = {'grant_type': "refresh_token", 'refresh_token': self.zoomConnection.refresh_token}

        resp = requests.post(url, headers=headers, params=params)
        if resp.status_code != 200:
            raise Exception(f"Failed to refresh token: {resp.text}")

        jsonResponse = resp.json()
        self.zoomConnection.access_token = jsonResponse['access_token']
        self.zoomConnection.refresh_token = jsonResponse['refresh_token']

        self.session.add(self.zoomConnection)
        self.session.commit()
