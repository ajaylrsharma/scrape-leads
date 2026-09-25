import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ApifyClient } from '@apify/client';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { google } from 'googleapis';

export const normalizeLead = (x) => ({
  name: x.title || x.name || x.companyName || '',
  website: x.website || x.url || '',
  phone: x.phone || x.phoneNumber || '',
  email: x.email || '',
  address: x.address || x.location || '',
  source: x.source || 'Apify',
  sourceUrl: x.url || x.link || '',
});

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ACTORS = {
  maps: process.env.APIFY_MAPS_ACTOR || 'compass/crawler-google-places',
  search: 'apify/google-search-scraper',
  linkedin: process.env.APIFY_LINKEDIN_ACTOR || 'curated_crawler/linkedin-search-scraper',
  yelp: process.env.APIFY_YELP_ACTOR,
  yellowpages: process.env.APIFY_YELLOWPAGES_ACTOR,
};

async function actorRows(actorId, input) {
  if (!actorId) return [];
  const run = await apify.actor(actorId).call(input);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1000 });
  return items.map(normalizeLead);
}

async function classify(lead, criteria) {
  if (!openai) return { ...lead, fitScore: null, classification: 'Unclassified' };
  const r = await openai.responses.create({
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    input: `Classify this public business lead. Return compact JSON with fitScore 0-100, summary, and answers array. Lead: ${JSON.stringify(lead)} Criteria: ${JSON.stringify(criteria)}`,
  });
  let parsed = {};
  try {
    parsed = JSON.parse(r.output_text);
  } catch {
    parsed = { summary: r.output_text };
  }
  return { ...lead, ...parsed };
}

async function saveSheet(rows, title) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const created = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const id = created.data.spreadsheetId;
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))] },
  });
  return `https://docs.google.com/spreadsheets/d/${id}`;
}

new Worker(
  'lead-scrapes',
  async (job) => {
    const p = job.data;
    const q = `${p.industry} ${p.location}`;
    await job.updateProgress(5);
    const tasks = [];
    if (p.sources?.includes('Google Maps'))
      tasks.push(actorRows(ACTORS.maps, { searchStringsArray: [q], maxCrawledPlacesPerSearch: p.limit || 250 }));
    if (p.sources?.includes('Google Search'))
      tasks.push(actorRows(ACTORS.search, { queries: [`${q} contact email`, `${q} "@gmail.com"`], maxPagesPerQuery: 5 }));
    if (p.sources?.includes('LinkedIn'))
      tasks.push(actorRows(ACTORS.linkedin, { searchQuery: `${q} owner OR founder OR director`, maxResults: Math.ceil((p.limit || 250) / 3) }));
    if (p.sources?.includes('Yelp')) tasks.push(actorRows(ACTORS.yelp, { search: q, location: p.location }));
    if (p.sources?.includes('Yellow Pages')) tasks.push(actorRows(ACTORS.yellowpages, { search: q, location: p.location }));
    const raw = (await Promise.all(tasks)).flat();
    await job.updateProgress(45);
    const seen = new Set();
    const unique = raw
      .filter((x) => {
        const k = (x.phone || x.website || `${x.name}|${x.address}`).toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, p.limit || 250);
    const limit = pLimit(10);
    const enriched = await Promise.all(unique.map((x) => limit(() => classify(x, p.criteria || []))));
    await job.updateProgress(85);
    const sheetUrl = await saveSheet(enriched, p.sheetName || `${p.industry} — ${p.location}`);
    await job.updateProgress(100);
    return { count: enriched.length, sheetUrl, notificationEmail: p.email, webhook: p.webhook || null, crm: p.crm || null };
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 3) }
);