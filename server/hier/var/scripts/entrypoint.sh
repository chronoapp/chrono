#!/bin/bash

alembic upgrade head
supervisord -n -c /etc/supervisord/supervisord.conf

/bin/bash
