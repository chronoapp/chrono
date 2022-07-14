import dramatiq
from dramatiq.brokers.redis import RedisBroker

redisBroker = RedisBroker(host="redis")
dramatiq.set_broker(redisBroker)
