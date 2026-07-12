import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  stripHtml,
  loadUrls,
  loadProcessed,
  saveProcessed,
  loadFetchedPages,
  appendFetchedPages,
} from '../../venue-seeder/step1-crawl-url';

// ---- loadUrls ----

describe('loadUrls', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-url-test-'));
    tmpFile = path.join(tmpDir, 'crawl-urls.txt');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('throws when the file does not exist', () => {
    expect(() => loadUrls(tmpFile)).toThrow('Input file not found');
  });

  it('reads one URL per line', () => {
    fs.writeFileSync(tmpFile, 'https://a.com\nhttps://b.com\n');
    expect(loadUrls(tmpFile)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('skips blank lines and comment lines', () => {
    fs.writeFileSync(tmpFile, 'https://a.com\n\n# a comment\nhttps://b.com\n');
    expect(loadUrls(tmpFile)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('trims surrounding whitespace', () => {
    fs.writeFileSync(tmpFile, '  https://a.com  \n');
    expect(loadUrls(tmpFile)).toEqual(['https://a.com']);
  });

  it('returns an empty array when the file has no valid lines', () => {
    fs.writeFileSync(tmpFile, '# only comments\n\n');
    expect(loadUrls(tmpFile)).toEqual([]);
  });
});

// ---- stripHtml ----

describe('stripHtml', () => {
  it('extracts visible body text', () => {
    const html = '<html><body><h1>Watch Party</h1><p>Join us at The Pub.</p></body></html>';
    expect(stripHtml(html)).toContain('Watch Party');
    expect(stripHtml(html)).toContain('Join us at The Pub.');
  });

  it('removes script tags', () => {
    const html = '<body><script>alert("xss")</script><p>Hello</p></body>';
    const result = stripHtml(html);
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
  });

  it('removes style tags', () => {
    const html = '<body><style>.foo { color: red }</style><p>Content</p></body>';
    const result = stripHtml(html);
    expect(result).not.toContain('.foo');
    expect(result).toContain('Content');
  });

  it('removes nav, header, footer', () => {
    const html = '<body><nav>Menu</nav><header>Top</header><main>Main content</main><footer>Footer</footer></body>';
    const result = stripHtml(html);
    expect(result).not.toContain('Menu');
    expect(result).not.toContain('Top');
    expect(result).not.toContain('Footer');
    expect(result).toContain('Main content');
  });

  it('collapses whitespace', () => {
    const html = '<body><p>Hello   \n\n   world</p></body>';
    expect(stripHtml(html)).toBe('Hello world');
  });

  it('returns empty string for empty body', () => {
    expect(stripHtml('<html><body></body></html>')).toBe('');
  });
});

// ---- loadProcessed / saveProcessed ----

describe('loadProcessed / saveProcessed', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-url-test-'));
    tmpFile = path.join(tmpDir, 'step1-processed-urls.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns empty set when file does not exist', () => {
    const result = loadProcessed(tmpFile);
    expect(result.size).toBe(0);
  });

  it('round-trips a set of URLs', () => {
    const urls = new Set(['https://a.com', 'https://b.com']);
    saveProcessed(urls, tmpFile);
    const loaded = loadProcessed(tmpFile);
    expect(loaded).toEqual(urls);
  });

  it('handles an empty set', () => {
    saveProcessed(new Set(), tmpFile);
    expect(loadProcessed(tmpFile).size).toBe(0);
  });
});

// ---- loadFetchedPages / appendFetchedPages ----

describe('loadFetchedPages / appendFetchedPages', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-url-test-'));
    tmpFile = path.join(tmpDir, 'step1and2-fetched-pages.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array when file does not exist', () => {
    expect(loadFetchedPages(tmpFile)).toEqual([]);
  });

  it('creates a new file when none exists', () => {
    appendFetchedPages([{ url: 'https://a.com', text: 'Hello' }], tmpFile);
    const result = loadFetchedPages(tmpFile);
    expect(result).toEqual([{ url: 'https://a.com', text: 'Hello' }]);
  });

  it('appends to existing pages without overwriting', () => {
    appendFetchedPages([{ url: 'https://a.com', text: 'A' }], tmpFile);
    appendFetchedPages([{ url: 'https://b.com', text: 'B' }], tmpFile);
    const result = loadFetchedPages(tmpFile);
    expect(result.map((p) => p.url)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('handles empty pages array gracefully', () => {
    appendFetchedPages([{ url: 'https://a.com', text: 'A' }], tmpFile);
    appendFetchedPages([], tmpFile);
    expect(loadFetchedPages(tmpFile)).toHaveLength(1);
  });
});
