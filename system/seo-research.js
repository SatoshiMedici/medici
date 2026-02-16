#!/usr/bin/env node
/**
 * MEDICI SEO Research Tool
 * Scrapes Google autocomplete + "People Also Ask" for keyword ideas.
 * No API key needed.
 *
 * Usage:
 *   node seo-research.js "AI marketing agency"
 *   node seo-research.js "AI marketing agency" --save
 *   node seo-research.js "startup growth" "web3 marketing" --save
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchAutocomplete(query) {
  return new Promise((resolve, reject) => {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed[1] || []);
        } catch { resolve([]); }
      });
    }).on('error', reject);
  });
}

async function expandKeyword(seed) {
  const modifiers = ['how to', 'best', 'top', 'why', 'what is', 'vs', 'for startups', 'tools', 'agency', 'cost'];
  const results = new Set();

  // Direct autocomplete
  const direct = await fetchAutocomplete(seed);
  direct.forEach(s => results.add(s));

  // Modified queries
  for (const mod of modifiers) {
    const suggestions = await fetchAutocomplete(`${seed} ${mod}`);
    suggestions.forEach(s => results.add(s));
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 100));
  }

  // Question modifiers
  const questions = ['how', 'what', 'why', 'when', 'where', 'can', 'does', 'is'];
  for (const q of questions) {
    const suggestions = await fetchAutocomplete(`${q} ${seed}`);
    suggestions.forEach(s => results.add(s));
    await new Promise(r => setTimeout(r, 100));
  }

  return [...results];
}

function categorize(keywords) {
  const categories = {
    'Informational (blog/guide)': [],
    'Commercial (service page)': [],
    'Transactional (landing page)': [],
    'Questions (FAQ/content)': [],
  };

  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (lower.match(/^(how|what|why|when|where|can|does|is|do)\b/)) {
      categories['Questions (FAQ/content)'].push(kw);
    } else if (lower.match(/(best|top|review|compare|vs|alternative)/)) {
      categories['Commercial (service page)'].push(kw);
    } else if (lower.match(/(buy|hire|price|cost|agency|service|company|freelance)/)) {
      categories['Transactional (landing page)'].push(kw);
    } else {
      categories['Informational (blog/guide)'].push(kw);
    }
  }
  return categories;
}

async function main() {
  const args = process.argv.slice(2);
  const save = args.includes('--save');
  const seeds = args.filter(a => a !== '--save');

  if (seeds.length === 0) {
    console.error('Usage: node seo-research.js "keyword" [--save]');
    process.exit(1);
  }

  let allKeywords = [];
  for (const seed of seeds) {
    console.log(`🔍 Researching: "${seed}"...\n`);
    const keywords = await expandKeyword(seed);
    allKeywords = allKeywords.concat(keywords);
  }

  // Deduplicate
  allKeywords = [...new Set(allKeywords)];

  const categories = categorize(allKeywords);
  let output = `# SEO Keyword Research — ${new Date().toISOString().split('T')[0]}\n`;
  output += `Seeds: ${seeds.join(', ')}\n`;
  output += `Total keywords found: ${allKeywords.length}\n\n`;

  for (const [cat, kws] of Object.entries(categories)) {
    if (kws.length === 0) continue;
    output += `## ${cat} (${kws.length})\n`;
    kws.forEach(kw => output += `- ${kw}\n`);
    output += '\n';
  }

  console.log(output);

  if (save) {
    const dir = path.join(__dirname, '..', 'content', 'seo');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(file, output);
    console.log(`💾 Saved to ${file}`);
  }

  // Content suggestions
  console.log('\n## 📝 Content Suggestions\n');
  const questions = categories['Questions (FAQ/content)'].slice(0, 5);
  const commercial = categories['Commercial (service page)'].slice(0, 3);
  if (questions.length > 0) {
    console.log('**Blog posts / Threads (answer these):**');
    questions.forEach(q => console.log(`  → ${q}`));
  }
  if (commercial.length > 0) {
    console.log('\n**Comparison / landing pages:**');
    commercial.forEach(q => console.log(`  → ${q}`));
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
