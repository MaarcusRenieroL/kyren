# Encrypted, off-machine backups of the database and uploaded files.
FROM alpine:3.21
RUN apk add --no-cache postgresql17-client age rclone curl tar gzip
COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
CMD ["/usr/local/bin/backup.sh", "schedule"]
