#!/bin/bash
WORKERS=$((2*`cat /proc/cpuinfo | grep 'core id' | wc -l`+1))
echo "Starting server with $WORKERS workers..."
exec gunicorn app.main:app -w $WORKERS -k uvicorn.workers.UvicornWorker --log-level=info --bind 0.0.0.0:8080 --timeout 30
