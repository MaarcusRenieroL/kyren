# Deploying Zentro on a VM

One machine runs everything with Docker Compose: Postgres (optional), the
database migrations, the app, a background-job runner and Caddy, which gets
and renews the HTTPS certificate.

## 1. Prepare the VM

- Ubuntu 22.04+ or Debian 12, at least 2 vCPU and 4 GB RAM (the first build
  needs about 3 GB of memory; add swap on a 2 GB machine).
- Install Docker Engine and the Compose plugin (`docker compose version`
  must print 2.20 or newer).
- Point your domain's DNS **A record** at the VM's public IP.
- Open ports **80** and **443** (and 22 for SSH). Nothing else needs to be
  reachable: the app and the database stay on Docker's private network.

## 2. Get the code

```bash
git clone <your repository> zentro && cd zentro
```

## 3. Write `deploy/.env`

Create `deploy/.env` (it is git-ignored by the root `.gitignore` rule for
`.env*`; keep it that way). Every value below is required unless marked
optional.

| Variable                                                                            | What to put                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DOMAIN`                                                                            | Your domain, e.g. `zentro.example.com` (no `https://`)                                                               |
| `POSTGRES_PASSWORD`                                                                 | A long random password (`openssl rand -hex 24`) — for the bundled database                                           |
| `DATABASE_URL`                                                                      | _Optional._ Only to use an outside database such as Neon instead of the bundled one                                  |
| `BETTER_AUTH_SECRET`                                                                | `openssl rand -base64 48`                                                                                            |
| `FIELD_ENCRYPTION_KEY`                                                              | `openssl rand -base64 32` (must be exactly 32 bytes). **Keep it safe: losing it makes encrypted fields unreadable.** |
| `CRON_SECRET`                                                                       | `openssl rand -hex 32`                                                                                               |
| `RESEND_API_KEY`                                                                    | Your Resend API key (sign-in codes, invitations and notification emails)                                             |
| `EMAIL_FROM`                                                                        | _Optional._ The sender, e.g. `Zentro <no-reply@example.com>` (a domain verified in Resend)                           |
| `ORGANIZATIONS_PER_PERSON`                                                          | _Optional._ Defaults to 10                                                                                           |
| `ANTHROPIC_API_KEY`                                                                 | _Optional._ Turns on the AI features                                                                                 |
| `ERROR_WEBHOOK_URL`                                                                 | _Optional._ Where server errors are posted                                                                           |
| `FILE_STORAGE`                                                                      | _Optional._ `local` (default: the `uploads` volume) or `s3`                                                          |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Only with `FILE_STORAGE=s3`                                                                                          |

Never set `E2E_SEED_SECRET` on a real deployment: it turns on a test-only
endpoint that creates accounts. The compose file doesn't pass it, so leave it
that way.

## 4. Start it

With the bundled database:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile db up -d --build
```

With an outside database (set `DATABASE_URL` in `deploy/.env`):

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
```

The `migrate` service runs every pending migration and exits; the app starts
only after it succeeds. Check:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps
curl -fsS https://$DOMAIN/api/health
```

### Moving an existing database (for example from Neon)

Before the first start against an existing database, check that nobody is in
the same organization twice; migration `0072` refuses to run if so:

```bash
psql "$DATABASE_URL" -c 'select "organizationId","userId",count(*) from member group by 1,2 having count(*)>1'
```

Merge any rows it prints, then start as above.

## 5. Email that arrives

Sign-up, verification, password reset, two-factor codes and invitations all
go through Resend. Without these records, mail lands in spam or is refused.

1. In Resend, add your domain (or a subdomain such as `mail.example.com`) and
   copy the DNS records it shows into your DNS provider:
   - **SPF** — a `TXT` record allowing Resend to send for the domain.
   - **DKIM** — the `TXT`/`CNAME` records Resend generates (signing key).
   - **DMARC** — a `TXT` record at `_dmarc.your-domain`, starting with
     `v=DMARC1; p=none; rua=mailto:dmarc@your-domain` and moving to
     `p=quarantine` once reports look clean.
2. Wait until Resend shows the domain as verified, then set `EMAIL_FROM` to an
   address on it, e.g. `Zentro <no-reply@mail.example.com>`.
3. **Bounces and spam complaints:** in Resend → Webhooks, add
   `https://$DOMAIN/api/email/events` for the `email.bounced` and
   `email.complained` events and put its signing secret in
   `RESEND_WEBHOOK_SECRET`. Addresses that bounce hard or complain are then
   never emailed again, which keeps your sending reputation (and Resend's
   limits) intact.
4. Invitations are capped at 100 per organization per hour and 3 per address
   per day, so no one can use Zentro to flood an inbox.

## 6. Backups (encrypted, off this machine)

The `backup` service dumps the database and the uploaded files every night
(02:30 UTC), encrypts them with [age](https://age-encryption.org) and copies
them to any storage rclone supports (an S3-compatible bucket, Backblaze B2, an
SFTP box…). It keeps 14 days and posts to `ALERT_WEBHOOK_URL` if a run fails.

Set up once:

```bash
# 1. A key pair. The public key goes in deploy/.env; the private key does NOT
#    stay on the VM (see "Keys" below).
docker run --rm alpine:3.21 sh -c "apk add -q age && age-keygen"
```

Add to `deploy/.env`:

| Variable                                                       | What to put                                          |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `BACKUP_AGE_RECIPIENT`                                         | The `age1…` public key printed above                 |
| `BACKUP_REMOTE`                                                | `remote:your-bucket/zentro`                          |
| `RCLONE_CONFIG_REMOTE_TYPE`                                    | `s3` (or `b2`, `sftp`, …)                            |
| `RCLONE_CONFIG_REMOTE_PROVIDER`                                | e.g. `Backblaze`, `Wasabi`, `Other`                  |
| `RCLONE_CONFIG_REMOTE_ENDPOINT`                                | the provider's S3 endpoint                           |
| `RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID` / `..._SECRET_ACCESS_KEY` | an access key that can write that bucket             |
| `ALERT_WEBHOOK_URL`                                            | _Optional._ Slack/Discord-style webhook for failures |

Check it works: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env run --rm backup backup.sh once`

### Keys — keep these somewhere other than the VM

- **The age private key.** Without it no backup can be read.
- **`FIELD_ENCRYPTION_KEY`.** Without it, encrypted fields (leave reasons, bank
  details) in every backup are unreadable forever.

Keep both in a password manager _and_ a second place (an offline copy). A
lost VM must not take the keys with it.

### Restoring

```bash
# List backups, then restore one (or "latest") into the running database.
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env run --rm backup restore.sh list
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env run --rm \
  -v /path/to/age.key:/run/age.key:ro -e BACKUP_AGE_IDENTITY=/run/age.key \
  backup restore.sh latest
```

**Drill result (2026-11-20):** the demo dataset (3 organizations, 9 users, 59
tasks, 35 chat messages, 81 migrations) was backed up, encrypted, and restored
into a brand-new Postgres 17 container; every table's row count matched, in
under a minute end to end. Repeat the drill on a fresh VM after launch and
whenever the data grows tenfold, and write the time down here.

## 7. Monitoring and alerts

Set `ALERT_WEBHOOK_URL` in `deploy/.env` (a Slack or Discord incoming webhook,
or any URL that accepts `{"text": "..."}`). Then:

- **Server errors** are posted to `ERROR_WEBHOOK_URL` as they happen (it can be
  the same URL).
- **The `cron` service watches the app every minute** and posts once when
  something breaks and once when it recovers:
  - background work failing 3 times in a row;
  - the private health check (`/api/health/deep`): the database down, jobs
    stuck for 15 minutes, or jobs that gave up after every retry;
  - the data disk above `DISK_ALERT_PERCENT` (85 by default).
- **Backups** post when a nightly run fails.
- **From outside:** the VM cannot report itself being down. Point any uptime
  checker you control (a second machine with `curl` in cron, or a monitoring
  service) at `https://$DOMAIN/api/health`, which answers only ok or not.

## 8. Updates and rollback

```bash
deploy/update.sh      # backup first, pull, build a tagged image, migrate, restart
deploy/rollback.sh    # back to the previous image (the database stays)
deploy/rollback.sh --restore   # also restore the pre-update backup (loses later writes)
```

Each release's image is tagged with its git commit, so the previous one is
still on the VM to roll back to. Migrations only ever add; a rollback of the
app alone is safe unless a release notes otherwise.

## 9. Capacity and load testing

`deploy/loadtest/zentro.js` is a k6 script: each virtual user signs in once,
opens a page, then polls notifications and chat every 3 seconds, the way an
open browser tab does. Run it from any machine with Docker:

```bash
docker run --rm -i -e BASE_URL=https://your.domain -e USERS=a@x.com,b@x.com -e PASSWORD='...' -e VUS=100 grafana/k6:0.54.0 run - < deploy/loadtest/zentro.js
```

Use test accounts, never real people's. Measured on 2026-11-20, one Node
process on an Apple M-series laptop with Postgres on the same machine:

| Open tabs | Requests/s | Failures | Pages p95 | Polls p95 |
| --------- | ---------- | -------- | --------- | --------- |
| 50        | ~45        | 0%       | 0.1 s     | 0.1 s     |
| 300       | ~136       | 0%       | 0.46 s    | 1.26 s    |

So one web container is comfortable up to roughly 150 people with Zentro open
at once; at 300 it still works but feels slow. Raising `DATABASE_POOL_MAX`
from 10 to 20 changed nothing at 300, so the limit is the single Node
process, not the database. Past that, the simplest step is a VM with faster
cores; running several `web` containers behind Caddy also works in principle
(Caddy's `dynamic a web 3000` upstreams) but has not been tested here. Keep `DATABASE_POOL_MAX` times the number of web
containers under Postgres's `max_connections` (100 by default).

## What runs

| Service   | Role                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `db`      | Postgres 17, data in the `pgdata` volume (only with `--profile db`)         |
| `migrate` | Applies database migrations, then exits                                     |
| `web`     | The Next.js app on port 3000 inside Docker; uploads in the `uploads` volume |
| `cron`    | Calls the background-work endpoint every minute; heavy sweeps at 03:00 UTC  |
| `caddy`   | HTTPS on 80/443, certificates from Let's Encrypt                            |

Caddy sets `X-Real-IP` from the real connection and drops any address headers
a client sends; the app trusts only that header (`CLIENT_IP_HEADERS`), so rate
limits and IP allow-lists can't be dodged by forging one.
