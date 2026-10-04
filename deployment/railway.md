# Railway MVP setup

Deploy the Bun/Python image backend as one Railway Docker service. Use the repository root as build context; do not set the root directory to `backend`, because the Dockerfile copies `backend/...` paths. `railway.json` selects `backend/Dockerfile`, `/ready` for deployment health checks, and bounded restart attempts. It does not create a project, volume, domain, or variables by itself.

## 1. Create the service and volume

1. Put the project in your own GitHub repository. In Railway, create a project and deploy that repository. Keep the service root at the repository root. Railway reads the root `railway.json`.
2. Before the first successful deployment, add a persistent volume mounted at `/data`. This stores the quota/job SQLite database, temporary uploads, finished results and Python caches. Keep exactly one service instance with this volume.
3. Paste the settings from [railway.env.example](railway.env.example) into the service Variables. Generate `QUOTA_SECRET` locally with `openssl rand -hex 32` and paste the result directly into Railway. It is a server-only secret. Never put it in an `EXPO_PUBLIC_*` variable or commit it.
4. Keep `RAILWAY_RUN_UID=0`: Railway volumes can initially be owned by root. The image entrypoint initializes volume ownership and immediately drops to the `studio` user before running the backend. Ordinary Docker/Compose continues starting as studio.
5. Deploy. The Docker build installs pinned image dependencies and downloads the background-removal model. The runtime readiness check validates imports and the model before opening the HTTP server. Inspect logs if the build or `/ready` check fails.

The template uses one worker, 4-megapixel input, 16-megapixel output, 20 accepted attempts per UTC day globally, and six-hour result retention. Guest credits remain three successful edits per UTC day per network; failures/cancellations refund guest credits, but they still consume the global attempt budget. A 4x upscale must start below one megapixel to fit the output cap. Choose small photos for the MVP. The app's consent says server results expire within 24 hours, which includes this shorter retention.

Railway Free's 0.5 GB RAM and 0.5 GB volume are tight for local inference. The smaller limits do not guarantee that background removal fits in 0.5 GB. For external testers, begin with enough memory for measured peak usage on your chosen plan, monitor disk usage and set a spending limit. Reduce image/retention/attempt limits if disk usage grows. The Linux AMD64 deployment image is available locally as `ai-enhancer-backend:mvp`; see [docker-image.md](docker-image.md) for export and registry deployment. Local AMD64 execution crashes during Bun initialization under QEMU on this ARM Mac, even for a one-line script. Verify `/ready` and real processing on Railway or a native x86 Linux host before opening to testers.

## 2. Generate the HTTPS endpoint

In service Settings → Networking, generate a public domain with target port **3001**, matching `PORT`. Railway terminates HTTPS; this deployment uses the API container directly and does not deploy the Compose Caddy service.

Verify:

```sh
curl --fail https://YOUR_SERVICE.up.railway.app/health
curl --fail https://YOUR_SERVICE.up.railway.app/ready
```

Expect `ok: true` and `provider: local` from health, and `ok: true` from ready. Perform a real photo upload, wait for completion, and test save/share in an Android preview APK. Cancel one job and verify that it does not consume a guest credit. Redeploy and verify that existing job results and quotas remain available on the volume.

`TRUST_RAILWAY_PROXY=true` uses Railway's documented `X-Real-IP` header for network quotas rather than grouping all users behind the platform proxy. It requires Railway's service/environment identifiers, supplied by the platform. Keep this service accessible only through Railway HTTPS ingress: do not add a TCP proxy or allow untrusted services to call it through private networking. The header trust is a deployment boundary, not account authentication. Outside Railway, leave this setting false; the original exact-IP `TRUSTED_PROXY_IPS` configuration still applies.

For an Android-only MVP, leave `ALLOWED_ORIGINS` empty. If publishing the Expo web app, set it to that app's exact HTTPS origin. Do not copy localhost origins from the development `.env`.

## 3. Connect the app and build

Set the following public app variables in the EAS **preview** environment for a tester APK, and in **production** when preparing a store AAB:

```dotenv
EXPO_PUBLIC_AI_PROVIDER=backend
EXPO_PUBLIC_PROCESSING_PROVIDER=local
EXPO_PUBLIC_BACKEND_PROXY_URL=https://YOUR_SERVICE.up.railway.app
```

Use your actual generated URL. Keep the existing LAN `.env` only if you still want local development; to test against Railway through Metro, update its backend URL and restart Expo with cache cleared. No API-domain or TLS configuration is needed in the app beyond this HTTPS address.

Build a tester APK after Expo login/project linking:

```sh
bunx eas-cli build --platform android --profile preview
```

For a store build, also configure real `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_SUPPORT_URL` in EAS production and run:

```sh
bunx eas-cli build --platform android --profile production
```

The local `.env` is excluded from EAS uploads, so configuring it alone does not configure cloud builds. Server variables remain in Railway; only the public app variables belong in EAS. The local provider has no paid inference API, but Railway compute/storage can cost money. Neural restoration can be added later using the pinned Replicate configuration documented in the main deployment guide.

Official references: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [config as code](https://docs.railway.com/config-as-code/reference), [volume permissions](https://docs.railway.com/volumes/reference), [public ingress headers](https://docs.railway.com/networking/public-networking/specs-and-limits), and [pricing](https://docs.railway.com/pricing/plans).
