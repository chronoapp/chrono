import redis
from app.core.config import REDIS_URL


def getRedisConnection():
    return redis.Redis.from_url(REDIS_URL)
