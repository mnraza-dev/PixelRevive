# Backend Docker image

Run these commands from the repository root with Docker running. Build Linux AMD64 for Railway, including on Apple Silicon:

```sh
docker buildx build --platform linux/amd64 --load \
  -f backend/Dockerfile -t ai-enhancer-backend:mvp .
```

The image includes Bun, the pinned Python dependencies and the `u2netp` background-removal model. The build context excludes local environment files, uploads, mobile assets and credentials. Supply server secrets at runtime.

## Local verification

The AMD64 image has been built and exported to `deployment/artifacts/ai-enhancer-backend-mvp-linux-amd64.tar.gz`, with a neighboring SHA-256 checksum file. On this ARM Mac, Bun crashes under QEMU even on a one-line script, so AMD64 runtime verification remains pending on Railway or a native x86 Linux host.

A separate native ARM image, `ai-enhancer-backend:local-check`, passed health/readiness, all seven processing modes, private result access checks, downloads and deletion. Its Railway-style root entrypoint initialized the `/data` volume and dropped the API process to UID 10001. This verifies the container setup on ARM; it does not certify AMD64 execution or production load.

## Railway

To deploy the already built image, publish it to your own registry. Replace `YOUR_DOCKERHUB_USER` with your actual account:

```sh
docker login
docker tag ai-enhancer-backend:mvp YOUR_DOCKERHUB_USER/ai-enhancer-backend:mvp
docker push YOUR_DOCKERHUB_USER/ai-enhancer-backend:mvp
```

In Railway, add a **Docker Image** service using that registry image name. Configure the variables from [railway.env.example](railway.env.example), a persistent `/data` volume, one replica, health check `/ready`, and a public domain targeting port `3001`. Keep `QUOTA_SECRET` persistent and server-only. For subsequent releases, use a new version tag and update the Railway image source.

Public registry images work on any Railway plan; private registry credentials require Pro. See [Railway's registry guide](https://docs.railway.com/guides/private-container-registry).

You can also deploy the GitHub repository directly: [railway.md](railway.md) uses the same Dockerfile and does not require pushing an image yourself.

## Portable image archive

```sh
mkdir -p deployment/artifacts
docker save ai-enhancer-backend:mvp | gzip > deployment/artifacts/ai-enhancer-backend-mvp-linux-amd64.tar.gz
```

On another Docker host:

```sh
docker load -i deployment/artifacts/ai-enhancer-backend-mvp-linux-amd64.tar.gz
```

Railway pulls from a registry; the archive is for transferring or backing up the built image. Keep generated archives out of Git.
