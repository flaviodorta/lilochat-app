#!/bin/bash
# database-per-service (CLAUDE.md §8, ADR-009): five logical databases, one dev instance.
# Services never cross database boundaries — splitting to separate instances later is config-only.
set -euo pipefail

for db in lilochat_identity lilochat_rooms lilochat_playback lilochat_chat lilochat_engagement; do
  echo "Creating database: ${db}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE ${db};
    GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${POSTGRES_USER};
EOSQL
done
