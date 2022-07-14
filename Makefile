build:
	docker compose -f docker-compose.dev.yml build

dev:
	docker compose -f docker-compose.dev.yml up -d

restart:
	docker compose -f docker-compose.dev.yml restart

stop:
	docker compose -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f api worker

bash:
	docker compose -f docker-compose.dev.yml run --rm api bash
