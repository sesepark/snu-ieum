#!/bin/sh
set -eu
umask 077
: "${BACKUP_RECIPIENT:?Set a verified GPG public-key fingerprint}"
: "${BACKUP_DIR:?Set local encrypted backup directory}"
: "${BACKUP_MIRROR_DIR:?Set a mounted directory on another device}"
case "$BACKUP_RECIPIENT" in *[!a-fA-F0-9]*) echo 'Use a full GPG fingerprint' >&2; exit 1;; esac
[ "${#BACKUP_RECIPIENT}" -ge 40 ] || exit 1
mkdir -p "$BACKUP_DIR"
[ -d "$BACKUP_MIRROR_DIR" ] || exit 1
[ "$(stat -c %d "$BACKUP_DIR")" != "$(stat -c %d "$BACKUP_MIRROR_DIR")" ] || { echo 'Mirror must be on another mounted filesystem' >&2; exit 1; }
BACKUP_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$BACKUP_TEMP_DIR"' EXIT HUP INT TERM
docker compose -f infra/compose.yml --env-file infra/.env exec -T db pg_dump -U ieum -d ieum -Fc > "$BACKUP_TEMP_DIR/database.dump"
docker compose -f infra/compose.yml --env-file infra/.env exec -T worker tar -C /var/lib/ieum/raw -cf - . > "$BACKUP_TEMP_DIR/raw.tar"
tar -C "$BACKUP_TEMP_DIR" -cf "$BACKUP_TEMP_DIR/backup.tar" database.dump raw.tar
BACKUP_NAME="ieum-$(date -u +%Y%m%dT%H%M%SZ).tar.gpg"
gpg --batch --encrypt --recipient "$BACKUP_RECIPIENT" --output "$BACKUP_DIR/$BACKUP_NAME.tmp" "$BACKUP_TEMP_DIR/backup.tar"
mv "$BACKUP_DIR/$BACKUP_NAME.tmp" "$BACKUP_DIR/$BACKUP_NAME"
cp "$BACKUP_DIR/$BACKUP_NAME" "$BACKUP_MIRROR_DIR/$BACKUP_NAME.tmp"
mv "$BACKUP_MIRROR_DIR/$BACKUP_NAME.tmp" "$BACKUP_MIRROR_DIR/$BACKUP_NAME"
date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/last-success.txt"
printf 'Encrypted database + raw artifacts backup and separate-device copy complete\n'
