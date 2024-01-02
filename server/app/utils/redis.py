import os
import redis

redisUrl = os.getenv('REDIS_URL', 'redis://redis:6379')


def getRedisConnection():
    return redis.Redis.from_url(redisUrl)
