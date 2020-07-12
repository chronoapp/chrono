## Timecouncil

Personal time tracker for google calendar.

### Develop

**Setup Log Aggregation**

```
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

Build Containers: `docker-compose build`
Run Containers: `docker-compose up -d`
Ssh into api: `docker-compose run --rm web bash`

### Database Migrations

```
# Make Revision
alembic revision -m "table changes" --autogenerate

# Upgrade Database
alembic upgrade head
```
