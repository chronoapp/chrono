FROM python:3.11-slim

RUN apt-get update -y && apt-get install -y\
    emacs\
    supervisor\
    gcc
    
RUN python -m pip install poetry

WORKDIR /app

# Cache dependencies
COPY pyproject.toml poetry.lock /app/
RUN poetry config virtualenvs.create false
RUN poetry config virtualenvs.in-project false
RUN poetry install

ADD hier /
COPY . /app

ENV PYTHONPATH=/app

CMD [ "/var/scripts/entrypoint.sh" ] 
