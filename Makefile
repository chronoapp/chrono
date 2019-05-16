bash:
	docker-compose run --rm api bash

tunnel:
	autossh -M 0 -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" -nNT -R 45.33.112.218:80:localhost:5555 root@45.33.112.218
