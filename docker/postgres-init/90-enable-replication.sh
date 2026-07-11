#!/bin/sh
# Allow the pg-backup sidecar to run pg_basebackup over the compose network
# (the docker image's default pg_hba has `host all` but not `host replication`).
# Runs once at initdb time, like the database-creation script next to it.
set -eu
echo 'host replication all all scram-sha-256' >> "$PGDATA/pg_hba.conf"
