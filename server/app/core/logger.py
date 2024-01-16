import logging
from app.core.config import LOG_LEVEL


def get_logger() -> logging.Logger:
    logLevel = logging.INFO
    if LOG_LEVEL == 'debug':
        logLevel = logging.DEBUG

    logging.basicConfig(format="%(levelname)s: %(message)s", level=logLevel)
    logger = logging.getLogger("uvicorn")
    logger.setLevel(logLevel)

    return logger


logger = get_logger()
