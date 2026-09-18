# Heartbeat Watchdog

![Build](https://github.com/nielsvdz-ops/heartbeat-watchdog/actions/workflows/docker-build.yml/badge.svg)

A small, containerized **"dead man's switch"** monitor: a machine sends it a heartbeat every ~60 seconds, and if the heartbeats stop, it alerts my phone via Telegram — a monitor that can detect the whole host going down, because it runs *outside* that host.

Built as the hands-on project for teaching myself cloud & DevOps end to end (Docker → Azure → Infrastructure as Code → CI/CD).

## Why

An external watchdog solves a flaw in host-local monitoring: a monitor running *on* the machine it watches dies with it and can't warn you. This one runs elsewhere, listens for a heartbeat, and only acts when the heartbeat goes silent.

## How it works

- **Heartbeat endpoint** (`GET/POST /heartbeat`) — the watched machine pings it to say "I'm alive"; the timestamp is recorded.
- **Silence detector** — if no heartbeat arrives within `GRACE_SECONDS`, it sends a **🔴 PC OFFLINE** alert; a returning heartbeat sends **🟢 back online**.
- **Alerts via Telegram** — reliable and works from anywhere.
- **Zero runtime dependencies** — pure Node.js built-ins (`http`, `fetch`), so the container image is tiny.

## Run it locally

```bash
docker build -t heartbeat-watchdog .
docker run --rm -it --env-file .env -p 8080:8080 heartbeat-watchdog
# send a heartbeat from another shell:
curl localhost:8080/heartbeat
```

Configuration (via environment variables — never baked into the image):

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (secret) |
| `TELEGRAM_CHAT_ID` | Chat to alert |
| `GRACE_SECONDS` | Offline threshold (default 180) |
| `PORT` | Listen port (default 8080) |

Copy `.env.example` to `.env` and fill in your values. `.env` is gitignored — **no secrets are committed**.

## CI/CD

Every push to `main` triggers a [GitHub Actions pipeline](.github/workflows/docker-build.yml) that:

1. Checks out the code
2. Logs in to Docker Hub (credentials stored as encrypted GitHub secrets)
3. Builds the image and pushes it, tagged with both `latest` and the **git commit SHA** (full image-to-source traceability)

## Tech stack

Node.js · Docker · GitHub Actions · Docker Hub · (deployable to Azure Container Instances / Azure Functions)

## Part of a larger DevOps learning journey

This repo is one milestone in a full self-taught path — Windows/WSL2, Docker, Azure (CLI, ACI, Functions), Infrastructure as Code (Bicep), and CI/CD — each stage documented with the real problems solved along the way (VPN/MTU container networking, secret rotation, isolating an Azure platform fault, and more).
