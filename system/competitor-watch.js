#!/usr/bin/env node
/**
 * MEDICI Competitor Watch Tool
 * Monitors competitor websites and social presence for changes.
 *
 * Usage:
 *   node competitor-watch.js scan --client medici
 *   node competitor-watch.js add --client medici --name "Competitor" --url "https://example.com" --x "@handle"
 *   node competitor-watch.js list --client medici
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const COMPETITORS_DIR = path.join(__dirname, '..', 'clients');

function getCompFile(client) {
  return path.join(COMPETITORS_DIR, client, 'competitors.json');
}

function loadCompetitors(client) {
  const file = getCompFile(client);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveCompetitors(client, data) {
  const file = getCompFile(client);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function extractMeta(html) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  const h1s = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map(m => m[1].trim());
  return { title, desc, ogTitle, ogDesc, h1s };
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return parsed;
}

async function scanCompetitors(client) {
  const competitors = loadCompetitors(client);
  if (competitors.length === 0) {
    console.log('No competitors tracked. Use: node competitor-watch.js add --client medici --name "Name" --url "URL"');
    return;
  }

  const date = new Date().toISOString().split('T')[0];
  let report = `# Competitor Scan — ${date}\n\n`;

  for (const comp of competitors) {
    console.log(`🔍 Scanning: ${comp.name} (${comp.url})...`);
    report += `## ${comp.name}\n`;
    report += `- URL: ${comp.url}\n`;
    if (comp.x) report += `- X: ${comp.x}\n`;

    try {
      const { body } = await fetch(comp.url);
      const meta = extractMeta(body);

      const changes = [];
      if (comp.lastTitle && comp.lastTitle !== meta.title) {
        changes.push(`Title changed: "${comp.lastTitle}" → "${meta.title}"`);
      }
      if (comp.lastDesc && comp.lastDesc !== meta.desc) {
        changes.push(`Description changed`);
      }

      report += `- Title: ${meta.title}\n`;
      report += `- Description: ${meta.desc.substring(0, 120)}\n`;
      if (meta.h1s.length > 0) report += `- H1s: ${meta.h1s.join(' | ')}\n`;
      if (changes.length > 0) {
        report += `- ⚠️ **Changes detected:**\n`;
        changes.forEach(c => report += `  - ${c}\n`);
      } else {
        report += `- No changes since last scan\n`;
      }

      // Update stored data
      comp.lastTitle = meta.title;
      comp.lastDesc = meta.desc;
      comp.lastScan = date;
    } catch (err) {
      report += `- ❌ Scan failed: ${err.message}\n`;
    }

    report += '\n';
  }

  saveCompetitors(client, competitors);

  // Save report
  const reportDir = path.join(COMPETITORS_DIR, client, 'competitor-reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${date}.md`);
  fs.writeFileSync(reportFile, report);

  console.log(`\n${report}`);
  console.log(`💾 Report saved: ${reportFile}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = parseArgs(args.slice(1));

  if (!opts.client) {
    console.error('Required: --client <name>');
    process.exit(1);
  }

  if (command === 'add') {
    if (!opts.name || !opts.url) {
      console.error('Required: --name "Name" --url "URL" [--x "@handle"]');
      process.exit(1);
    }
    const competitors = loadCompetitors(opts.client);
    competitors.push({ name: opts.name, url: opts.url, x: opts.x || null, addedAt: new Date().toISOString() });
    saveCompetitors(opts.client, competitors);
    console.log(`✅ Added: ${opts.name} (${opts.url})`);

  } else if (command === 'list') {
    const competitors = loadCompetitors(opts.client);
    if (competitors.length === 0) { console.log('No competitors tracked.'); return; }
    competitors.forEach(c => {
      console.log(`  ${c.name} — ${c.url}${c.x ? ' (' + c.x + ')' : ''} — last scan: ${c.lastScan || 'never'}`);
    });

  } else if (command === 'scan') {
    await scanCompetitors(opts.client);

  } else {
    console.log('Usage:');
    console.log('  node competitor-watch.js add --client medici --name "Name" --url "URL" [--x "@handle"]');
    console.log('  node competitor-watch.js list --client medici');
    console.log('  node competitor-watch.js scan --client medici');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
