# ScrapeLeads

A polished lead-generation dashboard with a production-oriented backend scaffold. Combines Apify source actors, concurrent LLM qualification, optional Scrapling enrichment, BullMQ/Redis background jobs, Google Sheets delivery, CRM/webhook destinations, and browser CSV exports.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Monetization](#monetization)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Capabilities
- **Multi-source scraping**: Google Maps, Google Search, LinkedIn, Yelp, Yellow Pages, adaptive website crawl
- **LLM-powered classification**: OpenAI GPT-4o-mini scoring (0-100) with custom buying signals
- **Email discovery & verification**: Public business email extraction with deliverability hints
- **Decision-maker enrichment**: Owner/founder/role matching via LinkedIn
- **Deduplication**: Phone, website, and name+address composite keys
- **Google Sheets delivery**: Auto-created spreadsheets with dynamic headers
- **CRM integration**: HubSpot, Pipedrive, Salesforce (UI scaffolded, adapters TODO)
- **Webhook delivery**: Zapier, Make.com, or custom endpoints
- **CSV export**: Browser download with proper escaping

### Dashboard UX
- 4-step wizard: Target → Sources → Enrichment → Delivery
- Real-time progress simulation (demo) / BullMQ polling (production)
- Local draft persistence via localStorage
- Responsive design with mobile sidebar
- Toast notifications, modal confirmations, keyboard navigation
- Accessible markup (ARIA, semantic HTML, focus management)

### Monetization
- **Google AdSense** integrated with publisher ID `pub-4113112840945038`
- Three ad placements: dashboard banner, runs page banner, sidebar

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server     │────▶│   Redis +       │
│   (SPA)         │     │   (Express)      │     │   BullMQ        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐             │
                        │   Worker         │◀────────────┘
                        │   (BullMQ)       │
                        └────────┬─────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Apify Actors  │    │   OpenAI LLM    │    │   Google APIs   │
│   (Maps/Search/ │    │   (Classification)     │   (Sheets/Drive)│
│    LinkedIn/    │    │                 │    │                 │
│    Yelp/YP)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲
         │
┌─────────────────┐
│   Scrapling     │
│   (Optional)    │
│   FastAPI       │
└─────────────────┘
```

### Data Flow
1. User submits job via `/api/jobs` (industry, location, sources, criteria, delivery config)
2. Server enqueues job to BullMQ queue `lead-scrapes` with retry/backoff config
3. Worker picks up job, runs Apify actors in parallel per selected source
4. Raw results normalized, deduplicated, sliced to `limit`
5. Each lead classified via OpenAI (10 concurrent via `p-limit`)
6. Enriched leads written to Google Sheets (new spreadsheet per run)
7. Job completes → webhook/email notification (scaffolded)

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Redis (local or managed)
- Python 3.11+ (optional, for Scrapling service)

### Installation

```bash
# Clone and install Node dependencies
cd scrape-leads
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see Configuration)
# Minimum required for demo: none (runs in-memory)

# Start development server
npm run dev
# → http://localhost:4173

# In separate terminal, start worker
npm run worker

# Optional: Start Scrapling enrichment service
pip install -r requirements.txt
uvicorn scrapling_worker:app --port 8000
```

### Demo Mode
Open `index.html` directly in a browser — the UI is fully interactive without a backend:
- Configure a run through the 4-step wizard
- Queue it (simulated)
- View animated progress
- Switch between Dashboard / Runs / Integrations / Settings
- Save draft to localStorage
- Download sample CSV

## Configuration

All configuration via environment variables (`.env`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4173` | HTTP server port |
| `REDIS_URL` | Prod | — | Redis connection string (enables BullMQ) |
| `APIFY_TOKEN` | Prod | — | Apify API token |
| `APIFY_MAPS_ACTOR` | No | `compass/crawler-google-places` | Google Maps actor ID |
| `APIFY_LINKEDIN_ACTOR` | No | `curated_crawler/linkedin-search-scraper` | LinkedIn actor ID |
| `APIFY_YELP_ACTOR` | No | — | Yelp actor ID (marketplace) |
| `APIFY_YELLOWPAGES_ACTOR` | No | — | Yellow Pages actor ID (marketplace) |
| `OPENAI_API_KEY` | Prod | — | OpenAI API key for classification |
| `LLM_MODEL` | No | `gpt-4o-mini` | OpenAI model for classification |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Prod | — | Service account JSON (single-line) for Sheets/Drive |
| `WORKER_CONCURRENCY` | No | `3` | BullMQ worker concurrency |
| `SCRAPLING_SERVICE_URL` | No | `http://localhost:8000` | Scrapling microservice URL |
| `SMTP_URL` | No | — | SMTP connection URL for emails |
| `WEBHOOK_SIGNING_SECRET` | No | — | HMAC secret for webhook verification |

### Apify Actor Selection
- **Google Maps**: `compass/crawler-google-places` (recommended) or `apify/google-maps-scraper`
- **Google Search**: `apify/google-search-scraper`
- **LinkedIn**: `curated_crawler/linkedin-search-scraper` (verify marketplace availability)
- **Yelp/Yellow Pages**: Require marketplace purchase; add actor IDs to `.env`

### Google Service Account
1. Create service account in Google Cloud Console
2. Enable Sheets API and Drive API
3. Grant `Editor` role on target Drive folder
4. Download JSON key, minify to single line: `cat key.json | tr -d '\n'`
5. Paste into `.env` as `GOOGLE_SERVICE_ACCOUNT_JSON`

## Development

### Commands
```bash
npm run dev        # Start dev server (Express + static)
npm run worker     # Start BullMQ worker
npm run start      # Production server (NODE_ENV=production)
npm run test       # Run unit tests (Vitest)
npm run test:watch # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e   # Playwright E2E tests
npm run lint       # ESLint
npm run format     # Prettier
```

### Frontend Development
- Edit `index.html`, `app.js`, `styles.css` directly
- No build step — served as static files by Express
- Changes visible on refresh

### Adding a New Source
1. Add actor ID to `ACTORS` in `worker.js`
2. Add source checkbox to `index.html` (step 2)
3. Add conditional task in worker job handler
4. Update `normalizeLead` if field mapping differs

### Adding a Custom Criterion
- UI: Click "+ Add criterion" in step 3 (max 6)
- Each criterion: question + Yes/No/Unknown select
- Sent to LLM as `criteria` array in job payload

## Testing

### Unit Tests (Vitest)
```bash
npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report (html in coverage/)
```

**Test Files:**
- `tests/unit/worker.test.js` — normalizeLead, deduplication, payload validation
- `tests/unit/server.test.js` — API endpoints, validation, health check

### E2E Tests (Playwright)
```bash
npm run test:e2e       # Requires dev server running
```

**Test Coverage:**
- Dashboard load, navigation, wizard flow
- Form validation, source toggles, criteria CRUD
- Draft save, job modal, CSV download
- Responsive design, accessibility (ARIA, focus)

### Python Tests (pytest)
```bash
cd tests/python
pip install -r ../../requirements.txt
pytest -v
```

**Test Coverage:**
- Scrapling `/extract` endpoint validation
- Response structure, limits
- Health endpoint

### Test Configuration Files
- `vitest.config.ts` — Vitest config with coverage
- `playwright.config.ts` — Multi-browser, mobile, webServer
- `pytest.ini` — pytest config

## Deployment

### Docker (Recommended)
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4173
CMD ["npm", "start"]
```

```bash
# Build
docker build -t scrape-leads .

# Run (with env file)
docker run -d -p 4173:4173 --env-file .env scrape-leads
```

### Worker Deployment
Run separately for horizontal scaling:
```bash
docker run -d --env-file .env scrape-leads npm run worker
```

### Scrapling Service
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install Playwright browsers
RUN playwright install chromium
COPY scrapling_worker.py .
EXPOSE 8000
CMD ["uvicorn", "scrapling_worker:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Checklist
- [ ] Redis managed instance (AWS ElastiCache, Railway, Upstash)
- [ ] Apify token with actor access
- [ ] OpenAI API key with sufficient quota
- [ ] Google Service Account with Sheets/Drive permissions
- [ ] SMTP credentials for completion emails
- [ ] Domain + TLS (Cloudflare, Vercel, nginx)
- [ ] Authentication (JWT/OAuth) — **NOT IMPLEMENTED**
- [ ] Rate limiting per workspace — **NOT IMPLEMENTED**
- [ ] Encrypted credential storage — **NOT IMPLEMENTED**
- [ ] Audit logging — **NOT IMPLEMENTED**
- [ ] Usage limits/billing — **NOT IMPLEMENTED**

### Environment-Specific Config
```bash
# Production
NODE_ENV=production
REDIS_URL=redis://user:pass@host:6379
APIFY_TOKEN=apify_xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

## Security

### Current State
⚠️ **This is a scaffold — not production-ready without security hardening.**

| Concern | Status | Mitigation Needed |
|---------|--------|-------------------|
| Authentication | ❌ Missing | Add JWT/session auth, workspace isolation |
| Authorization | ❌ Missing | Role-based access (owner/member/viewer) |
| Input Validation | ⚠️ Partial | Zod schemas for all API inputs |
| Rate Limiting | ❌ Missing | Per-workspace/IP limits on `/api/jobs` |
| Credential Storage | ❌ Plaintext env | Encrypt at rest (Vault, AWS KMS) |
| Webhook Verification | ⚠️ Secret only | HMAC signature validation |
| CSP Headers | ❌ Missing | Add `helmet` middleware |
| Audit Logs | ❌ Missing | Log job create/start/complete/fail |
| Data Retention | ❌ Missing | Auto-delete old jobs/leads |

### Recommended Security Additions
```javascript
// server.js - add early
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://pagead2.googlesyndication.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://pagead2.googlesyndication.com"],
      connectSrc: ["'self'", "https://api.apify.com", "https://api.openai.com"],
    },
  },
}));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 30 }));
```

### Legal/Compliance
- **Robots.txt**: Respect each source's `robots.txt` and ToS
- **GDPR/CCPA**: Only collect public business info; no personal data
- **Apify Terms**: Review actor-specific terms per geography
- **Email Outreach**: CAN-SPAM/GDPR compliance for any follow-up
- **Data Processing Agreement**: Required for Google Sheets API

## Monetization

### Google AdSense Integration
Publisher ID: `pub-4113112840945038`

**Placements:**
1. **Dashboard banner** — Top of wizard, above hero (responsive, auto-format)
2. **Runs page banner** — Below page heading, above stats
3. **Sidebar** — Above plan card, full-width responsive

**Implementation:**
- Async AdSense script in `<head>` with `crossorigin="anonymous"`
- `<ins class="adsbygoogle">` slots with `data-ad-client`, `data-ad-slot`
- Initialization: `(adsbygoogle = window.adsbygoogle || []).push({})`
- CSS: `.adsense-banner`, `.adsense-sidebar` with min-height

**Ad Slot IDs** (replace with your actual slots):
- Dashboard: `1234567890`
- Runs: `1234567891`
- Sidebar: `1234567892`

### Revenue Optimization
- Enable Auto ads for additional placements
- Test ad density vs. user retention
- Consider AdSense Matched Content for related articles
- Monitor Policy Center for compliance

## Project Structure

```
scrape-leads/
├── index.html              # Main SPA entry point
├── app.js                  # Frontend logic (wizard, state, API)
├── styles.css              # Full stylesheet (formatted)
├── server.js               # Express API + BullMQ queue
├── worker.js               # BullMQ worker (Apify, LLM, Sheets)
├── scrapling_worker.py     # Optional FastAPI enrichment service
├── package.json            # Node deps, scripts, engines
├── requirements.txt        # Python deps
├── .env.example            # Environment template
├── vitest.config.ts        # Vitest config
├── playwright.config.ts    # Playwright config
├── pytest.ini              # pytest config
├── README.md               # This file
├── tests/
│   ├── unit/
│   │   ├── worker.test.js
│   │   └── server.test.js
│   ├── e2e/
│   │   └── dashboard.spec.ts
│   └── python/
│       └── test_scrapling_worker.py
└── coverage/               # Generated by vitest
```

## API Reference

### POST `/api/jobs`
Create a new lead scrape job.

**Request:**
```json
{
  "industry": "Dentists",
  "location": "Mumbai, India",
  "email": "user@company.com",
  "limit": 250,
  "sources": ["Google Maps", "Google Search", "LinkedIn", "Website crawl"],
  "criteria": [
    "Does this business currently run Google Ads?",
    "Does this dentist offer cosmetic dentistry?"
  ],
  "sheetName": "Mumbai Dentist Leads — Sep 2026",
  "notify": "Email when complete",
  "crm": "HubSpot",
  "webhook": "https://hooks.zapier.com/..."
}
```

**Response (202):**
```json
{ "id": "job-uuid", "status": "queued" }
```

### GET `/api/jobs/:id`
Get job status and progress.

**Response (200):**
```json
{
  "id": "job-uuid",
  "status": "active|completed|failed",
  "progress": 67,
  "result": { "count": 183, "sheetUrl": "https://docs.google.com/...", ... }
}
```

### GET `/health`
Health check for load balancers.

**Response:**
```json
{ "ok": true, "queue": true, "mode": "development" }
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Worker doesn't start | `REDIS_URL` not set | Set `REDIS_URL` in `.env` |
| Apify runs return 0 results | Actor ID wrong / quota exceeded | Verify actor ID, check Apify dashboard |
| OpenAI classification fails | API key invalid / model unavailable | Check `OPENAI_API_KEY`, use `gpt-4o-mini` |
| Google Sheets error | Service account JSON malformed | Validate JSON, check API enablement |
| CSV download empty | Demo mode only | Connect backend for real data |
| AdSense not showing | New account / policy review | Wait for approval, check Policy Center |
| Mobile sidebar stuck | CSS not loaded | Hard refresh, check `styles.css` |

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm run test && npm run test:e2e`
4. Lint & format: `npm run lint && npm run format`
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Style
- ESLint + Prettier (see configs)
- JSDoc for exported functions
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with**: Node.js, Express, BullMQ, Apify, OpenAI, Google APIs, Scrapling, Vitest, Playwright