from enum import Enum

from app.db.models import User
from app.utils.redis import getRedisConnection


class FlagType(Enum):
    EXPAND_ALL_DAY_EVENTS = "EXPAND_ALL_DAY_EVENTS"
    INITIAL_SYNC_COMPLETE = "INITIAL_SYNC_COMPLETE"
    ONBOARDING_COMPLETE = "ONBOARDING_COMPLETE"
    DISABLE_TAGS = "DISABLE_TAGS"


class FlagUtils:
    """Flags and settings that can be changed by the user.
    Redis will act as a persistent, fast-access data store.
    """

    def __init__(self, user: User):
        self.user = user
        self.conn = getRedisConnection()

    def get(self, flagType: FlagType) -> bool:
        key = self._getFlagKey(flagType)
        flag = self.conn.get(key)
        return flag == b'True'

    def set(self, flagType: FlagType, value: bool):
        key = self._getFlagKey(flagType)
        return self.conn.set(key, 'True' if value else 'False')

    def getAllFlags(self) -> dict[FlagType, bool]:
        """Retrieve all flag settings for the user."""
        flags = {}
        for flagType in FlagType:
            flagValue = self.get(flagType)
            flags[flagType] = flagValue
        return flags

    def setAllFlags(self, flags: dict[FlagType, bool]) -> dict[FlagType, bool]:
        """Set all flag settings for the user."""
        for flagType, value in flags.items():
            self.set(flagType, value)
        return flags

    def _getFlagKey(self, flagType: FlagType) -> str:
        return f'{flagType.value}:{self.user.id}'
