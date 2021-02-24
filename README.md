## Timecouncil

Timecouncil is an extensible calendar with analytics.

### Develop

**Setup Log Aggregation**

```
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

Setup Poetry
`poetry config virtualenvs.in-project true`

Build Containers: `docker-compose build`
Run Containers: `docker-compose up -d`
Ssh into api: `docker-compose run --rm web bash`

### Database Migrations

**Make Revision**
`alembic revision -m "table changes" --autogenerate`

**Upgrade Database**
`alembic upgrade head`

To test webhooks, add a tunnel `tunnelto --port 8888 --subdomain mydemoapp`
