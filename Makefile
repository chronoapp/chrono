build:
	docker compose -f docker-compose.dev.yml build

dev:
	docker compose -f docker-compose.dev.yml up -d

stop:
	docker compose -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f api

bash:
	docker compose -f docker-compose.dev.yml run --rm api bash
