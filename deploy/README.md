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

## 5. Updates

```bash
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile db up -d --build
```

Migrations run again on every start; ones already applied are skipped.

## 6. Backups

The bundled database and the uploaded files are Docker volumes
(`zentro-prod_pgdata`, `zentro-prod_uploads`). A nightly backup, for example
from cron on the VM:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec -T db \
  pg_dump -U zentro -Fc zentro > /var/backups/zentro-$(date +%F).dump
docker run --rm -v zentro-prod_uploads:/data -v /var/backups:/out alpine \
  tar czf /out/zentro-uploads-$(date +%F).tgz -C /data .
```

Copy those files off the VM. Restore the database with
`pg_restore -U zentro -d zentro --clean <file>`.

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
