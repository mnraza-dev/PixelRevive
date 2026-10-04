# Production deployment

This release is a single-server guest photo studio. It uses durable SQLite quotas by network address, separate 256-bit private job tokens, two bounded image workers, a global daily attempt budget, and 24-hour result expiry. People on the same public network share the quota. It does not provide account authentication, subscriptions, cross-device libraries, or a distributed queue. Scale to one API instance only; a shared filesystem alone does not coordinate multiple workers. Paid inference needs provider-side spending caps in addition to the daily attempt budget.

## Railway MVP

For Railway, follow [railway.md](railway.md). The root `railway.json` configures the existing Docker backend and `/ready` health check. Create the persistent volume and set the service variables in Railway before deploying. The Docker Compose instructions below are for a separate Linux server.

To build, export, or deploy a prebuilt container, follow [docker-image.md](docker-image.md).

## Server

Use a Linux server with Docker Compose, at least 4 GB RAM, sufficient disk for at most 100 results per day, and a public domain pointed at it. For CPU-heavy large images, increase memory or lower the job/image limits after load testing. Only ports 80/443 are public; never expose port 3001. Keep Docker images patched.

1. Copy `deployment/production.env.example` to `deployment/production.env`. Set your real `API_DOMAIN` and a random persistent `QUOTA_SECRET` generated with `openssl rand -hex 32`. Choose the provider and daily budget. Neural deployments also require the full model version hashes listed in the environment template. Keep this file private.
2. Run `docker compose --env-file deployment/production.env -f deployment/compose.yaml up --build -d` from the repo root. The image installs pinned Python dependencies and pre-downloads the background model. The API runs as an unprivileged user with a read-only root filesystem.
3. Verify `https://YOUR_API_DOMAIN/health` and `/ready`, then test upload → status → save → share → delete on an Android release APK. Also exercise denied camera/save permissions, offline mode, cancellation, daily limits, restart recovery, and low storage.
4. Alert on non-200 readiness, sustained 429/5xx, worker failures, CPU/memory and disk usage. Application lifecycle logs include only mode/provider/duration/error type and intentionally exclude photos/tokens. Predictions also get a four-minute provider-side cancellation deadline; paid usage must still be tested with your actual models. Do not enable query-string access logging at a CDN/proxy. Configure retention for any infrastructure logs.
5. Preserve the `photo_data` volume and quota secret across updates. Avoid backing up photo files; the persistent quota database can be backed up with SQLite's online backup facility if needed. Backups must have explicit retention and access controls.

The bundled proxy is the only trusted forwarded-IP source, at `172.30.0.2`. If you change the Docker subnet/proxy topology, change `TRUSTED_PROXY_IPS` to the exact proxy IP and ensure it overwrites or appends `X-Forwarded-For`. Arbitrary forwarded headers from direct clients are ignored. Deploy behind a CDN/WAF with request and upload rate limits before opening to heavy public traffic; the app's global budget caps accepted attempts, including failed/canceled attempts, not inbound bandwidth attacks.

For updates, rerun the same compose command after checks. For rollback, rebuild the previous known-good commit with the same volume/secret. Do not run `down -v`: it deletes quotas and retained results. There are no destructive database migrations in this version. Expired results are inaccessible immediately and swept once per minute; interrupted originals are removed on startup. DELETE with a job token cancels running work or immediately removes a finished server result.

## App release

Set these in the EAS **production** environment:

- `EXPO_PUBLIC_AI_PROVIDER=backend`
- `EXPO_PUBLIC_PROCESSING_PROVIDER=local` or `replicate`, matching the backend
- `EXPO_PUBLIC_BACKEND_PROXY_URL=https://YOUR_API_DOMAIN`
- `EXPO_PUBLIC_PRIVACY_URL=https://YOUR_PUBLIC_PRIVACY_PAGE`
- `EXPO_PUBLIC_SUPPORT_URL=https://YOUR_PUBLIC_SUPPORT_PAGE`

They are public configuration, never secret keys. Release validation refuses mock processing, HTTP/private endpoints, missing policy/support links, and example domains. Provider matching also prevents a silent switch from local processing to an external AI provider without matching the app's upload consent.

Run `bun run check` and `bunx expo-doctor`. Authenticate with `bunx eas-cli login`, link the real Expo project with `bunx eas-cli init`, and create an internal release APK with `bunx eas-cli build --platform android --profile preview` using the equivalent preview environment. After testing on real phones, use `bunx eas-cli build --platform android --profile production` for the store AAB and `bunx eas-cli submit --platform android --profile production` when your store credentials and listing are ready. The native directories are generated and excluded from EAS uploads. This version does not configure OTA updates.

## Release owner requirements

Publish an accurate privacy page and support contact. Describe photo upload/storage, server region/operator, 24-hour result retention, processed file metadata removal, local original/edit storage, guest network quota identifiers, deletion, and any external Replicate processing and provider retention. Do not claim all photos remain on-device or promise provider deletion you haven't verified. The app asks permission before uploading each selected photo and has a local data-delete action.

Complete the store privacy/data safety forms from your actual deployment, supply screenshots and a description that match tested model quality, verify ownership/licensing of icons and sample/model assets, and review the licenses/terms for your chosen neural models and weights. The default local portrait/restoration tools perform classical correction; they are not neural face reconstruction. The sample comparison is labeled illustrative.

Do not mark the launch complete until the hosted backend, physical-device release test, provider billing test (if enabled), image/container vulnerability scan, store signing and public policy/support URLs have been verified. The local code checks cannot certify these external items.
