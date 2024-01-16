from fastapi import WebSocket, WebSocketDisconnect, APIRouter

from app.core.notifications import websocketManager
from app.core.logger import logger

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def notificationsConnection(websocket: WebSocket, client_id: str):
    """Initializes a websocket connection for a client."""
    await websocketManager.connect(client_id, websocket)
    try:
        while True:
            message = await websocket.receive_text()
            await websocketManager.sendClientMessage(client_id, message)

    except WebSocketDisconnect:
        logger.info(f"Client #{client_id} disconnected.")
        websocketManager.disconnect(client_id, websocket)
