# PixelRevive image backend

Expo SDK 57 app with real image uploads and a self-hosted Bun/Python backend. Processing uses the user's photo; demo results are only enabled explicitly with `EXPO_PUBLIC_AI_PROVIDER=mock`.

## Start locally

Requires Bun and Python (prefer Python 3.11–3.13 for current rembg releases).

```sh
bun install
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cp .env.example .env
bun run backend
```

In another terminal:

```sh
bun start
```

Set `EXPO_PUBLIC_BACKEND_PROXY_URL` in `.env` to the server URL. On a physical phone, use your computer's LAN IP (e.g. `http://192.168.1.10:3001`); Android emulator uses `http://10.0.2.2:3001`. Restart Expo after changing environment variables (`bunx expo start --clear`). For a physical phone, keep both devices on the same Wi-Fi; `localhost` points to the phone, not your computer. The app checks backend health before uploading and reports unreachable addresses clearly. Add the exact Expo web origin to `ALLOWED_ORIGINS` if using a different port. Use HTTPS for hosted deployments.

Background removal downloads the small `u2netp` ONNX model to `backend/models` on first use. Pre-download it before serving requests:

```sh
U2NET_HOME="$PWD/backend/models" NUMBA_CACHE_DIR="$PWD/backend/data/numba" backend/.venv/bin/python -c "from rembg import new_session; new_session('u2netp')"
```

The first background-removal request can take longer while Python compiles dependencies. Model download needs internet; subsequent local processing does not send photos to an external provider.

## Features and limits

| Mode | Free self-hosted processing | Optional Replicate processing |
| --- | --- | --- |
| Auto enhance | Denoise, contrast/color balance, sharpen | Real-ESRGAN with face enhancement |
| Face enhance | Denoise and sharpen | GFPGAN neural face reconstruction |
| Photo restoration | Clean noise and recover faded colors | GFPGAN face restoration |
| Blurry to clear / sharpen | Unsharp masking | Real-ESRGAN detail enhancement |
| HD upscale | Lanczos 2x/4x resize | Real-ESRGAN neural super-resolution |
| Color enhance | Contrast and saturation correction | Local color correction |
| Remove background | U2Net segmentation with transparent PNG | rembg model |

Classical sharpening cannot recover missing detail from severe blur. Local restoration does not reconstruct faces or remove scratches. GFPGAN restores faces, not arbitrary damage across an entire photo. No provider guarantees identity preservation or perfect recovery. Local inference has no API fee; hosting still has a cost. Replicate requires a funded account and bills the app owner.

For neural processing, set `BACKEND_PROVIDER=replicate` and **server-only** `REPLICATE_API_TOKEN`. Never put API tokens in `EXPO_PUBLIC_*` or app.json. The server resolves real version IDs and input schemas from Replicate; pin full hashes using `REPLICATE_VERSION_AUTO`, `REPLICATE_VERSION_FACE_ENHANCE`, etc. for reproducibility. No placeholder model IDs are used.

## API

- `GET /health`: available modes and configured provider.
- `POST /jobs`: multipart `image` (JPEG/PNG/WebP, up to 15 MB), `settings` (JSON with `mode`, optional 2/4 `scale` and 0–100 strengths). Include `processingProvider=local` or `replicate` matching upload consent. Returns HTTP 202, a random job ID and a private 256-bit token.
- `GET /jobs/:id`: requires `Authorization: Bearer <token>`; status, progress, stages, error, measured result metadata.
- `GET /jobs/:id/result?token=<token>`: PNG after success. Use the returned resultPath; keep the URL private.
- `DELETE /jobs/:id`: requires the token header; cancels queued/running work or deletes a finished result.

Jobs allow two concurrent workers, a five-minute deadline, 20 megapixel input and 40 megapixel local output limits. Failed/canceled jobs refund their reserved daily quota. Originals are deleted after processing. Results expire after 24 hours. Mobile results are copied into app documents for history; web results expire with the server job. Save/share use real platform APIs. Camera/photo permission config changes require rebuilding native binaries.

The guest server enforces three free successful jobs per UTC day per network address by default (`DAILY_FREE_LIMIT`). SQLite job metadata and quotas survive restarts. Network addresses are HMAC-hashed; production requires a persistent server-only `QUOTA_SECRET`. Separate private job tokens protect status, download and deletion; only token hashes are stored in the database. People sharing a public IP also share the quota. IPv6 clients are grouped by /64.

A global daily attempt budget (`GLOBAL_DAILY_LIMIT=100`) remains consumed even when a request fails or is canceled, because external inference can still be billed. Guest credits are refunded for failures/cancellations. Interrupted work is marked failed after restart, with guest credit refunded once. Originals, including copies prepared for an external provider, are deleted after processing; interrupted originals are deleted on startup. External-provider upload copies and all outputs have EXIF/location metadata removed. Results become inaccessible after 24 hours and are cleaned once per minute.

The app retains up to 50 native edits and their comparison originals in app-owned documents. Removing a library edit deletes its local files. A profile action removes app-owned library/guest data, and production links open real support/privacy pages. Release builds reject mock processing and local HTTP backends. Upload consent names the configured provider; matching checks prevent silently sending a photo to a different provider.

See [deployment/README.md](deployment/README.md) for the Docker/HTTPS server, EAS build configuration, release environment and outstanding owner checks. This is a single-instance guest deployment; authenticated accounts, subscriptions and distributed workers are outside this version.

## Checks

```sh
bun run check
bunx expo-doctor
```

Backend tests exercise real local processing, upload validation, quota enforcement, cancellation and PNG retrieval. Replicate needs credentials for an actual paid inference test. The backend uses Bun's HTTP server and Node child-process APIs without Express dependencies.
