# Comprehensive Code Review — ScrapeLeads

## Executive Summary

**Overall Assessment:** The ScrapeLeads project is a well-architected lead-generation dashboard with a production-oriented backend scaffold. It demonstrates strong technical foundations: modular BullMQ/Redis job processing, concurrent LLM qualification via OpenAI, Apify actor integration, Google Sheets delivery, and an optional Scrapling enrichment microservice. The frontend is a polished, fully-interactive SPA with progressive wizard UX, local draft persistence, and simulated job runs for demo purposes.

**Major Strengths:**
- Clean separation of concerns (API server, worker, optional Python enrichment service)
- BullMQ with exponential backoff, retries, and concurrency control
- 10-at-a-time LLM processing with `p-limit` prevents rate-limit exhaustion
- Deduplication logic using phone/website/name+address composite keys
- Responsive, accessible frontend with keyboard navigation, ARIA attributes, and toast notifications
- Environment-driven configuration via `.env` (no hardcoded secrets)
- Progressive enhancement: UI works without backend (demo mode)

**Highest-Priority Improvements:**
1. **Critical:** No authentication/authorization — anyone with API access can queue jobs, consume credits, and exfiltrate leads
2. **Critical:** No input validation/sanitization beyond required-field checks — injection risks in actor inputs, sheet titles, webhook URLs
3. **High:** No test coverage — zero unit, integration, or E2E tests
4. **High:** Google AdSense monetization not implemented (requested)
5. **High:** README lacks deployment, security, and operational guidance
6. **Medium:** Worker lacks structured logging, metrics, and dead-letter handling
7. **Medium:** Frontend demo simulation is hardcoded; no real API integration path documented
8. **Low:** CSS is minified single-line — difficult to maintain/extend

---

## Critical Issues

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| No authentication on `/api/jobs` or `/api/jobs/:id` | **High** | Add JWT/session auth, workspace isolation, rate limiting per workspace |
| No input sanitization for actor inputs, sheet names, webhook URLs | **High** | Validate/sanitize all user-supplied strings; allowlist URL schemes for webhooks |
| Zero test files | **High** | Add Vitest for backend, Playwright for E2E, pytest for Python service |
| Google AdSense not integrated | **High** | Add AdSense auto-ads + manual placements per publisher ID `pub-4113112840945038` |
| Worker has no dead-letter queue or observability | **Medium** | Add `failed` event handler, structured JSON logs, Prometheus metrics endpoint |
| Hardcoded demo data in `app.js:21` | **Medium** | Replace with dynamic API call when backend connected; document integration |
| No CSP headers, no Helmet equivalent | **Medium** | Add `helmet` middleware; configure CSP for inline scripts/styles |
| `GOOGLE_SERVICE_ACCOUNT_JSON` parsed at runtime without validation | **Medium** | Validate JSON structure at startup; fail fast with clear error |
| No request size limits on actor input payloads | **Low** | Add explicit limits per actor; prevent memory exhaustion |
| CSS delivered as single minified line | **Low** | Split into maintainable modules; add build step with PostCSS |

---

## Potential Hallucinations / Claims Requiring Verification

| Statement | Location | Verification Needed |
|-----------|----------|---------------------|
| "Apify source actors" — specific actor IDs like `compass/crawler-google-places` and `curated_crawler/linkedin-search-scraper` | README:3, worker.js:11 | Verify actors exist on Apify marketplace, check current pricing and rate limits |
| "10-at-a-time LLM processing" | README:34, worker.js:15 | Confirm `p-limit(10)` aligns with OpenAI tier limits (RPM/TPM) |
| "BullMQ/Redis background jobs" | README:3 | Verify BullMQ v5 API compatibility with current code |
| "Google Sheets delivery" + "CRM/webhook destinations" | README:3 | CRM adapters (HubSpot/Pipedrive/Salesforce) are UI placeholders only — not implemented in worker |
| "Completion email settings" | README:3 | Email sending not implemented; `SMTP_URL` in `.env.example` unused |
| "Browser CSV exports" | README:6 | Works for demo data only; real job results not wired to download |
| "Optional Scrapling enrichment" | README:34 | `scrapling_worker.py` requires `scrapling[fetchers]` — verify package availability and Playwright dependency |
| "Responsible rate limits" (UI claim) | index.html:40 | No rate-limit config exposed to user; worker concurrency only |
| "Encrypted credential storage" (checklist item) | README:28 | Not implemented |
| "Audit logs" (checklist item) | README:28 | Not implemented |
| "Usage limits" (checklist item) | README:28 | Not implemented |

---

## Improvement Suggestions

### Accuracy
- Replace hardcoded demo leads in `app.js` with real API response handling
- Validate Apify actor IDs against current marketplace; document fallback actors
- Verify `gpt-4.1-mini` model name — as of 2026, this model may not exist; use `gpt-4o-mini` or configurable
- Add schema validation for `GOOGLE_SERVICE_ACCOUNT_JSON` at worker startup

### Structure
- Split `worker.js` into modules: `actors/`, `classifier/`, `sheets/`, `dedupe/`
- Extract frontend state management from `app.js` into a lightweight store
- Add `/api/health` detailed checks (Redis, Apify, OpenAI, Google APIs)
- Create `config/` directory for environment validation (Zod schemas)

### Readability
- Format `styles.css` with proper indentation and logical sections
- Add JSDoc comments to all exported functions in `server.js`, `worker.js`
- Use consistent naming: `lead` vs `row` vs `item` — standardize on `lead`
- Document the job payload schema (TypeScript interfaces or JSON Schema)

### Engagement
- Add real-time progress via Server-Sent Events or WebSocket (currently polls `/api/jobs/:id`)
- Implement "Run history" with persistent storage (currently in-memory Map)
- Add lead preview modal before CSV download
- Show estimated cost/credits before job start (currently static summary card)

### SEO / Search Discoverability
- Add structured data (JSON-LD) for `SoftwareApplication` on `index.html`
- Include `robots.txt` and `sitemap.xml` for public landing page
- Meta tags: `og:title`, `og:description`, `og:image`, `twitter:card`
- Semantic HTML: `<main>`, `<section>`, `<article>` already used correctly

### Professional Tone
- Replace "ScrapeLeads" with consistent branding (currently "ScrapeLeads" vs "Scrape Leads")
- Standardize error messages: user-friendly + debug context
- Add `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`
- License file (MIT recommended for scaffold projects)

---

## Revised Version

The following files are updated in-place. See **Change Log** for details.

### 1. `package.json` — Added test scripts, dev dependencies, AdSense types