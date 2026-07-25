#!/bin/sh
set -e

python manage.py collectstatic --noinput

exec python socket_server.py
