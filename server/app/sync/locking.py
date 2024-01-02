import os
import uuid
import redis
import time
import logging

from typing import Optional

from app.utils.redis import getRedisConnection


"""
https://redislabs.com/ebook/part-2-core-concepts/chapter-6-application-components-in-redis/6-2-distributed-locking/
"""


def _lockkey(lockId: str):
    return f'lock:{lockId}'


def acquireLock(lockId: str, acquire_timeout: int = 10, lock_timeout: int = 10) -> Optional[str]:
    """Locking expires in 15 minutes to make sure other processes
    are unlocked if a the lock's owner crashes.
    """
    conn = getRedisConnection()
    lockkey = _lockkey(lockId)

    # A 128-bit random identifier.
    identifier = str(uuid.uuid4())

    end = time.time() + acquire_timeout
    while time.time() < end:
        if conn.setnx(lockkey, identifier):
            conn.expire(lockkey, lock_timeout)
            logging.debug(f'acquired lock {lockkey}..')

            return identifier

        elif not conn.ttl(lockkey):
            conn.expire(lockkey, lock_timeout)

        time.sleep(0.2)

    return None


def releaseLock(lockId: str, identifier: Optional[str]):
    if not identifier:
        return False

    conn = getRedisConnection()
    pipe = conn.pipeline(True)
    lockkey = _lockkey(lockId)

    while True:
        try:
            pipe.watch(lockkey)
            keyValue = pipe.get(lockkey)
            if keyValue and keyValue.decode('utf-8') == identifier:
                pipe.multi()
                pipe.delete(lockkey)
                pipe.execute()
                logging.debug(f'released lock {lockkey}..')

                return True

            pipe.unwatch()
            break

        except redis.exceptions.WatchError:
            pass

    return False
