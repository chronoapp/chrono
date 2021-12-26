## Timecouncil

Timecouncil is an extensible calendar with analytics.

### Develop

We use [Poetry](https://python-poetry.org/) for package management.

Run `poetry config virtualenvs.in-project true` to enable virtualenvs to be created in the project directory.

In the server/ directory, install packages with `poetry install`. In your editor settings, the python path will be at `${workspaceFolder}/server/.venv`.

Build Containers `docker-compose -f docker-compose.dev.yml build`\
Run Containers `docker-compose -f docker-compose.dev.yml up -d`\
SSH into Container `docker-compose run -f docker-compose.dev.yml --rm web bash`

**Setup Log Aggregation Plugins**

```
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

### Database Migrations

**Make Revision**
`alembic revision -m "table changes" --autogenerate`

**Upgrade Database**
`alembic upgrade head`

To test webhooks, add a tunnel `tunnelto --port 8888 --subdomain mydemoapp`
