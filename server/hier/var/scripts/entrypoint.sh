#!/bin/bash

alembic upgrade head
supervisord -n -c /etc/supervisord/supervisord-prod.conf

/bin/bash
