import dramatiq
import os
from dramatiq.brokers.redis import RedisBroker

redisUrl = os.getenv('REDIS_URL', 'redis://redis:6379')
redisBroker = RedisBroker(url=redisUrl)

dramatiq.set_broker(redisBroker)
dramatiq.set_encoder(dramatiq.PickleEncoder)
