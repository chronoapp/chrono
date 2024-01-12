import redis
import json
import asyncio

from fastapi import WebSocket
from app.core.logger import logger


class ConnectionManager:
    """Manages active websocket connections.

    This is part of the API server, which has multiple processes running.
    In memory data structures are not shared between processes.

    A client could have multiple websocket connections open, so we keep a list
    of connections per client.
    """

    def __init__(self) -> None:
        self.connectionMap: dict[str, list[WebSocket]] = {}

    async def connect(self, clientID: str, websocket: WebSocket):
        await websocket.accept()
        if clientID not in self.connectionMap:
            self.connectionMap[clientID] = []

        self.connectionMap[clientID].append(websocket)
        logger.info(f"Client #{clientID} connected.")

    def disconnect(self, clientID: str, websocket: WebSocket):
        if clientID in self.connectionMap:
            self.connectionMap[clientID].remove(websocket)
            if not self.connectionMap[clientID]:
                del self.connectionMap[clientID]

            logger.info(f"Client #{clientID} disconnected.")

    async def sendClientMessage(self, clientID: str, message: str):
        if clientID in self.connectionMap:
            for websocket in self.connectionMap[clientID]:
                logger.info(f"Sending to {clientID}: {message}")
                await websocket.send_text(message)

    async def broadcast(self, message: str):
        logger.info(f"Broadcasting: {message}")
        for _, connections in self.connectionMap.items():
            for websocket in connections:
                await websocket.send_text(message)


websocketManager = ConnectionManager()


def notification_listener():
    """Listen to notifications from redis and send them to the client.

    Look for the websocket connection within the manager and sends the message
    to the client if it exists.
    """
    r = redis.Redis(host='redis', port=6379, db=0)
    pubsub = r.pubsub()
    pubsub.subscribe('app_notifications')

    for message in pubsub.listen():
        if message['type'] == 'message':
            messageData = json.loads(message['data'])
            clientID = messageData['clientID']
            messageText = messageData['text']

            asyncio.run(websocketManager.sendClientMessage(clientID, messageText))


def send_notification(clientID: str, message: str):
    """Sends a notification to the client.

    Every process in the API server will receive the notification, but only
    the one that has the websocket connection will send it to the client.
    """
    r = redis.Redis(host='redis', port=6379, db=0)
    r.publish('app_notifications', json.dumps({'clientID': clientID, 'text': message}))
