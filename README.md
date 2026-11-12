# EcoScan

> Measure the carbon footprint of a web page, with a frugal AI action plan.

**Status:** step 2 / 8, safe outgoing requests (SSRF protection)

## Architecture

EcoScan is built as a modular monorepo with a strict separation of concerns:

- **HTTP API (`src/main.ts`)**: NestJS server handling incoming requests, validation, and RFC 9457 Problem Details error formatting.
- **Background Worker (`src/worker.ts`)**: Standalone NestJS application context designed to process heavy page analysis jobs asynchronously.
- **Safe Fetch Module (`src/core/safe-fetch`)**: The only component allowed to access the internet, enforcing strict SSRF protections (allow-list IP validation, custom DNS lookup at connection time, manual redirect verification, stream byte limits, and zip-bomb protection).
- **Web Interface (`web/`)**: Lightweight React + TypeScript frontend built with Vite.
- **Infrastructure (`docker-compose.yml`)**: Local Redis instance for shared state and job queuing.

## Prerequisites

- **Node.js** >= 20 (LTS)
- **Docker** & **Docker Compose**

## Getting Started

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com
   cd ecoscan
   npm install
   cd web && npm install && cd ..
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Generate a secure `IP_HASH_SALT` (at least 16 characters) using `openssl rand -hex 32` and update your `.env` file.*

3. **Start local infrastructure (Redis):**
   ```bash
   docker compose up -d
   ```

4. **Run the applications (in separate terminals):**
   - **API:** `npm run start:dev` (runs on `http://localhost:3000/api/v1`)
   - **Worker:** `npm run start:worker:dev`
   - **Frontend:** `cd web && npm run dev` (runs on `http://localhost:5173`)

## Quality & Testing

- **Type checking:** `npm run typecheck`
- **Linter:** `npm run lint`
- **Unit tests:** `npm test`
- **End-to-end tests:** `npm run test:e2e` (requires Redis running)
- **Production build:** `npm run build`

## Architecture Decision Records (ADR)

- `docs/adr/0001-*.md` — Foundations & Architecture
- `docs/adr/0002-ssrf-protection.md` — Outgoing HTTP requests & SSRF protection

## License

This project is licensed under the MIT License.
