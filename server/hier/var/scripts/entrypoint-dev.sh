#!/bin/bash

alembic upgrade head
supervisord -n -c /etc/supervisord/supervisord-dev.conf

/bin/bash
