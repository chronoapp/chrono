#!/bin/bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml run --rm api alembic upgrade head
