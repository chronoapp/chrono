## Chrono

Chrono is an extensible calendar with analytics.

Design: https://www.figma.com/file/694PGgPKdlrY75oYBwbFy3/Chrono?type=design&node-id=0%3A1&mode=design&t=j5S3ix8D1ibBpPzN-1

### Development

We use Docker for local development.

1) Set up your .env file

Copy over the `.env.example` file to `.env` and fill in the necessary environment variables.

2) Build and run the containers

```bash
./scripts/docker-build.sh
./scripts/docker-start.sh
```

3) Start the frontend

```bash
cd frontend
yarn dev
```

3) Develop!

To view server and worker logs, run `./scripts/docker-logs.sh`.

To SSH into the container, run `./scripts/docker-shell.sh`.

##### Python Autocompletions
We use [Poetry](https://python-poetry.org/) for package management.

In the server/ directory, install packages with `poetry install`. This will install python packages in server/.venv`.

### Database Migrations

**Make Revision**

`alembic revision -m "table changes" --autogenerate`

**Upgrade Database**

`alembic upgrade head`

