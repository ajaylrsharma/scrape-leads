"""Optional Scrapling microservice hook for adaptive website enrichment."""
from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl

try:
    from scrapling.fetchers import StealthyFetcher
    SCRAPLING_AVAILABLE = True
except ImportError:
    SCRAPLING_AVAILABLE = False
    StealthyFetcher = None

app = FastAPI(title="ScrapeLeads Website Enrichment")


class Request(BaseModel):
    url: HttpUrl


@app.post('/extract')
def extract(req: Request):
    if not SCRAPLING_AVAILABLE:
        return {
            'url': str(req.url),
            'text': '',
            'emails': [],
            'links': [],
            'error': 'scrapling package not installed',
        }

    page = StealthyFetcher.fetch(str(req.url), headless=True, network_idle=True)
    text = ' '.join(page.css('body ::text').getall())[:30000]
    links = [x.attrib.get('href') for x in page.css('a[href]') if x.attrib.get('href')]
    emails = sorted({x for x in text.replace('(', ' ').replace(')', ' ').split() if '@' in x and '.' in x})
    return {'url': str(req.url), 'text': text, 'emails': emails[:20], 'links': links[:200]}


@app.get('/health')
def health():
    return {'ok': True, 'scrapling_available': SCRAPLING_AVAILABLE}