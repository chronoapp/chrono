import dramatiq
from dramatiq.brokers.redis import RedisBroker
from app.core.config import REDIS_URL

redisBroker = RedisBroker(url=REDIS_URL)

dramatiq.set_broker(redisBroker)
dramatiq.set_encoder(dramatiq.PickleEncoder)
