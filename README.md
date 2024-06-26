## Chrono

Chrono is an extensible calendar with analytics.

Design: https://www.figma.com/file/694PGgPKdlrY75oYBwbFy3/Chrono?type=design&node-id=0%3A1&mode=design&t=j5S3ix8D1ibBpPzN-1

### Development

We use Docker for local development.

1) Set up your .env file

Copy over the `.env.example` file to `.env` and fill in the necessary environment variables.

To setup Chrono with your own Google OAuth credentials, you will need to create a project in the Google Cloud Console and create OAuth 2.0 credentials. Set the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables in the `.env` file.

For use with Zoom, you will need to create an Oauth app in the Zoom Developer Console and set the `ZOOM_API_KEY` and `ZOOM_API_SECRET` environment variables in the `.env` file.

In order to OAuth with Google and get updates through webhooks, you'll need to use a reverse proxy like [ngrok](https://ngrok.com/) to expose your local server to the internet. 

2) Build and start the backend container.

Docker build only needs to be done once, or when you make changes to the Dockerfile
or add new python dependencies.

```bash
./scripts/docker-build.sh
./scripts/docker-start.sh
```

3) Start the frontend

```bash
cd client
yarn install
yarn dev
```

4) Develop!

Go to http://localhost:3300 in your browser.

To view server and worker logs, run `./scripts/docker-logs.sh`.

To SSH into the container, run `./scripts/docker-shell.sh`.

##### Python Autocompletions
We use [Poetry](https://python-poetry.org/) for package management.

In the server/ directory, install packages with `poetry install`. This will install python packages in server/.venv`.

### Database Migrations

Inside the docker container (run `scripts/docker-shell.sh`), you can run the following commands to create and apply database migrations.

**Make Revision**

`alembic revision -m "table changes" --autogenerate`

**Upgrade Database**

`alembic upgrade head`

### Deployment

TODO: Add deployment options and instructions:

1) Use DigitalOcean App Platform
2) render.com
