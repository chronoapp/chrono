import logging


def get_logger(log_level):
    logging.basicConfig(format="%(levelname)s: %(message)s", level=log_level)
    logger = logging.getLogger("uvicorn")
    logger.setLevel(log_level)
    return logger


logger = get_logger(logging.INFO)
