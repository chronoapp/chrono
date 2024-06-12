#
# This is the Dockerfile user for Production builds of Chrono.
#
# 1) frontend-build: build the frontend (static assets)
# 2) build the api and copy the frontend build.
#

#
# ======== Frontend Build ========
#
FROM node:18.19.1-bullseye-slim AS frontend-build

WORKDIR /app
SHELL ["/bin/bash", "-e", "-o", "pipefail", "-c"]

COPY client/ client/
RUN cd client && yarn install && yarn build

#
# ======== API Build ========
#
FROM python:3.12-slim-bullseye

WORKDIR /app

# Install dependencies
RUN apt-get update -y && apt-get install -y\
    emacs\
    supervisor\
    gcc\
    nginx

RUN python -m pip install poetry

# Nginx setup
RUN rm /etc/nginx/sites-enabled/default

# Cache dependencies
COPY server/pyproject.toml server/poetry.lock /app/
RUN poetry config virtualenvs.create false
RUN poetry config virtualenvs.in-project false
RUN poetry install

ADD server/hier /
COPY server /app

# Copy built static files from frontend
COPY --from=frontend-build /app/client/dist /app/public

ENV PYTHONPATH=/app

CMD [ "/var/scripts/entrypoint.sh" ] 
