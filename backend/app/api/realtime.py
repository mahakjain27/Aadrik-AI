import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.database import queries

logger = logging.getLogger(__name__)

router = APIRouter()

POLL_INTERVAL_SECONDS = 2
SEND_TIMEOUT_SECONDS = 5
ALLOWED_ROLES = ("admin", "manager", "sales")


@router.websocket("/ws/inbox")
async def inbox_websocket(websocket: WebSocket, token: str):
    payload = decode_access_token(token)

    if payload is None:
        await websocket.close(code=4401)
        return

    user = queries.get_user_by_id(int(payload["sub"]))

    if user is None or not user["is_active"] or user["role"] not in ALLOWED_ROLES:
        await websocket.close(code=4403)
        return

    await websocket.accept()

    last_version = None

    try:
        while True:
            version = queries.get_sessions_version()

            if version != last_version:
                last_version = version
                await asyncio.wait_for(
                    websocket.send_json({"type": "sessions_changed"}),
                    timeout=SEND_TIMEOUT_SECONDS,
                )

            await asyncio.sleep(POLL_INTERVAL_SECONDS)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        logger.exception("inbox websocket connection failed unexpectedly")
