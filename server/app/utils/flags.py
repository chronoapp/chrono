from enum import Enum

from app.db.models import User
from app.utils.redis import getRedisConnection


class FlagType(Enum):
    EXPAND_ALL_DAY_EVENTS = "EXPAND_ALL_DAY_EVENTS"
    INITIAL_SYNC_COMPLETE = "INITIAL_SYNC_COMPLETE"
    ONBOARDING_COMPLETE = "ONBOARDING_COMPLETE"
    DISABLE_TAGS = "DISABLE_TAGS"

    """The timezone string that the user has been prompted to update.
    E.g. America/New_York

    This is used to prevent prompting the user to update their timezone
    every time if they already said no to updating the timezone.
    """
    LAST_PROMPTED_TIMEZONE_TO_CHANGE = "LAST_PROMPTED_TIMEZONE_TO_CHANGE"

    SHOULD_PROMPT_TIMEZONE_CHANGE = "SHOULD_PROMPT_TIMEZONE_CHANGE"


class FlagDefaults:
    defaultValues = {
        FlagType.EXPAND_ALL_DAY_EVENTS: False,
        FlagType.INITIAL_SYNC_COMPLETE: False,
        FlagType.ONBOARDING_COMPLETE: False,
        FlagType.DISABLE_TAGS: False,
        FlagType.LAST_PROMPTED_TIMEZONE_TO_CHANGE: '',
        FlagType.SHOULD_PROMPT_TIMEZONE_CHANGE: True,
    }


class FlagUtils:
    """Flags and settings that can be changed by the user.
    Redis will act as a persistent, fast-access data store.
    """

    def __init__(self, user: User):
        self.user = user
        self.conn = getRedisConnection()

    def get(self, flagType: FlagType):
        key = self._getFlagKey(flagType)
        flag = self.conn.get(key)
        defaultValue = FlagDefaults.defaultValues[flagType]

        if flag is None:
            return defaultValue

        if isinstance(defaultValue, bool):
            return flag == b'True'

        return flag.decode()

    def set(self, flagType: FlagType, value: str | bool):
        key = self._getFlagKey(flagType)
        valueToStore = 'True' if value is True else 'False' if value is False else value

        return self.conn.set(key, valueToStore)

    def getAllFlags(self) -> dict[FlagType, bool | str]:
        """Retrieve all flag settings for the user."""
        flags = {}

        for flagType in FlagType:
            flags[flagType] = self.get(flagType)

        return flags

    def setAllFlags(self, flags: dict[FlagType, bool | str]) -> dict[FlagType, bool | str]:
        results = {}
        for flagType, value in flags.items():
            result = self.set(flagType, value)
            results[flagType] = result

        return results

    def _getFlagKey(self, flagType: FlagType):
        return f'{flagType.value}:{self.user.id}'
