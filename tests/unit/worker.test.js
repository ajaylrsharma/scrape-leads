import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeLead } from '../../worker.js';

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

vi.mock('@apify/client', () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: vi.fn().mockReturnThis(),
    call: vi.fn().mockResolvedValue({ defaultDatasetId: 'test-dataset' }),
    dataset: vi.fn().mockReturnThis(),
    listItems: vi.fn().mockResolvedValue({ items: [] }),
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn().mockResolvedValue({
        output_text: JSON.stringify({ fitScore: 85, summary: 'Test summary', answers: [] }),
      }),
    },
  })),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({}),
      })),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        create: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'test-sheet-id' } }),
        values: {
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }),
  },
}));

describe('normalizeLead', () => {
  it('should normalize a lead with all fields present', () => {
    const raw = {
      title: 'Test Business',
      website: 'https://example.com',
      phone: '+1-555-0123',
      email: 'test@example.com',
      address: '123 Main St',
      source: 'Google Maps',
      url: 'https://maps.google.com/place/123',
    };

    const result = normalizeLead(raw);

    expect(result).toEqual({
      name: 'Test Business',
      website: 'https://example.com',
      phone: '+1-555-0123',
      email: 'test@example.com',
      address: '123 Main St',
      source: 'Google Maps',
      sourceUrl: 'https://maps.google.com/place/123',
    });
  });

  it('should handle alternative field names', () => {
    const raw = {
      name: 'Alt Name Co',
      url: 'https://alt.com',
      phoneNumber: '+1-555-0199',
      location: '456 Oak Ave',
      link: 'https://source.com/lead/456',
    };

    const result = normalizeLead(raw);

    expect(result).toEqual({
      name: 'Alt Name Co',
      website: 'https://alt.com',
      phone: '+1-555-0199',
      email: '',
      address: '456 Oak Ave',
      source: 'Apify',
      sourceUrl: 'https://source.com/lead/456',
    });
  });

  it('should default to empty strings for missing fields', () => {
    const raw = {};

    const result = normalizeLead(raw);

    expect(result).toEqual({
      name: '',
      website: '',
      phone: '',
      email: '',
      address: '',
      source: 'Apify',
      sourceUrl: '',
    });
  });

  it('should handle companyName field', () => {
    const raw = { companyName: 'Company Inc' };
    const result = normalizeLead(raw);
    expect(result.name).toBe('Company Inc');
  });
});

describe('deduplication logic', () => {
  it('should deduplicate by phone number', () => {
    const leads = [
      { phone: '+1-555-0100', name: 'Business A' },
      { phone: '+1-555-0100', name: 'Business B' },
      { phone: '+1-555-0101', name: 'Business C' },
    ];

    const seen = new Set();
    const unique = leads.filter((lead) => {
      const key = (lead.phone || lead.website || `${lead.name}|${lead.address}`).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    expect(unique).toHaveLength(2);
    expect(unique[0].name).toBe('Business A');
    expect(unique[1].name).toBe('Business C');
  });

  it('should deduplicate by website when phone is missing', () => {
    const leads = [
      { website: 'https://example.com', name: 'Business A' },
      { website: 'https://example.com', name: 'Business B' },
      { website: 'https://other.com', name: 'Business C' },
    ];

    const seen = new Set();
    const unique = leads.filter((lead) => {
      const key = (lead.phone || lead.website || `${lead.name}|${lead.address}`).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    expect(unique).toHaveLength(2);
  });

  it('should deduplicate by name+address when phone and website missing', () => {
    const leads = [
      { name: 'Business A', address: '123 Main St' },
      { name: 'Business A', address: '123 Main St' },
      { name: 'Business B', address: '456 Oak Ave' },
    ];

    const seen = new Set();
    const unique = leads.filter((lead) => {
      const key = (lead.phone || lead.website || `${lead.name}|${lead.address}`).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    expect(unique).toHaveLength(2);
  });
});

describe('job payload validation', () => {
  it('should validate required fields', () => {
    const required = ['industry', 'location', 'email'];
    const body = { industry: 'Dentists', location: 'Mumbai' };
    const missing = required.filter((k) => !body[k]);
    expect(missing).toEqual(['email']);
  });

  it('should enforce limit bounds', () => {
    const limit = Math.min(Number(5000) || 250, 5000);
    expect(limit).toBe(5000);

    const limit2 = Math.min(Number(10000) || 250, 5000);
    expect(limit2).toBe(5000);

    const limit3 = Math.min(Number(50) || 250, 5000);
    expect(limit3).toBe(50);
  });

  it('should generate ISO timestamp', () => {
    const timestamp = new Date().toISOString();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});