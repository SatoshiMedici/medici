#!/usr/bin/env node
/**
 * MEDICI Social Card Generator
 * Generates branded SVG social cards that can be converted to PNG.
 *
 * Usage:
 *   node social-card.js --title "Your headline here" --subtitle "Optional subtitle"
 *   node social-card.js --title "Headline" --type linkedin
 *   node social-card.js --title "Headline" --type x
 *   node social-card.js --title "Headline" --type og
 */

const fs = require('fs');
const path = require('path');

const SIZES = {
  x:        { w: 1200, h: 675 },   // X/Twitter card
  linkedin: { w: 1200, h: 627 },   // LinkedIn share
  og:       { w: 1200, h: 630 },   // Open Graph default
  square:   { w: 1080, h: 1080 },  // Instagram / general
};

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

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function generateSVG(title, subtitle, type) {
  const size = SIZES[type] || SIZES.og;
  const { w, h } = size;

  const titleLines = wrapText(title, type === 'square' ? 18 : 28);
  const titleFontSize = titleLines.length > 2 ? 48 : 56;
  const titleStartY = subtitle
    ? h / 2 - (titleLines.length * titleFontSize * 0.6)
    : h / 2 - (titleLines.length * titleFontSize * 0.5) + titleFontSize * 0.3;

  const titleSVG = titleLines.map((line, i) =>
    `<text x="${w/2}" y="${titleStartY + i * titleFontSize * 1.2}" 
      font-family="Georgia, 'Playfair Display', serif" font-size="${titleFontSize}" 
      font-weight="600" fill="#FFFFFF" text-anchor="middle">${escXml(line)}</text>`
  ).join('\n    ');

  const subtitleSVG = subtitle ? `
    <text x="${w/2}" y="${titleStartY + titleLines.length * titleFontSize * 1.2 + 20}" 
      font-family="-apple-system, 'Inter', sans-serif" font-size="22" 
      fill="#AAAAAA" text-anchor="middle">${escXml(subtitle)}</text>` : '';

  // M logo path (geometric)
  const logoScale = 0.6;
  const logoX = w / 2 - 24 * logoScale;
  const logoY = h - 80;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#141414"/>
    </linearGradient>
    <!-- Gold accent gradient -->
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#C9A84C"/>
      <stop offset="100%" stop-color="#E8C84A"/>
    </linearGradient>
    <!-- Subtle grid pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1A1A" stroke-width="0.5"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)" opacity="0.5"/>
  
  <!-- Top gold line -->
  <rect x="0" y="0" width="${w}" height="3" fill="url(#gold)"/>
  
  <!-- Corner decorations -->
  <circle cx="60" cy="60" r="30" fill="none" stroke="#C9A84C" stroke-width="0.5" opacity="0.15"/>
  <circle cx="${w-60}" cy="${h-60}" r="30" fill="none" stroke="#C9A84C" stroke-width="0.5" opacity="0.15"/>
  <line x1="40" y1="40" x2="100" y2="40" stroke="#C9A84C" stroke-width="0.5" opacity="0.1"/>
  <line x1="${w-100}" y1="${h-40}" x2="${w-40}" y2="${h-40}" stroke="#C9A84C" stroke-width="0.5" opacity="0.1"/>
  
  <!-- Title -->
  ${titleSVG}
  ${subtitleSVG}
  
  <!-- Bottom bar: Logo + brand -->
  <line x1="${w*0.2}" y1="${h-100}" x2="${w*0.8}" y2="${h-100}" stroke="#C9A84C" stroke-width="0.5" opacity="0.2"/>
  
  <!-- M logo -->
  <g transform="translate(${logoX}, ${logoY}) scale(${logoScale})">
    <path d="M6 38 L6 14 L16 26 L24 10 L32 26 L42 14 L42 38" 
      fill="none" stroke="#C9A84C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  
  <!-- Brand text -->
  <text x="${w/2 + 20}" y="${h - 62}" font-family="Georgia, serif" font-size="16" 
    fill="#C9A84C" letter-spacing="0.15em" text-anchor="start">MEDICI</text>
  <text x="${w/2 + 20}" y="${h - 46}" font-family="-apple-system, sans-serif" font-size="11" 
    fill="#666666">medici.codes</text>
</svg>`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.title) {
    console.log('Usage: node social-card.js --title "Headline" [--subtitle "Sub"] [--type x|linkedin|og|square]');
    process.exit(0);
  }

  const type = opts.type || 'og';
  const svg = generateSVG(opts.title, opts.subtitle || null, type);

  const dir = path.join(__dirname, '..', 'assets', 'cards');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const slug = opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  const file = path.join(dir, `${slug}-${type}.svg`);
  fs.writeFileSync(file, svg);

  console.log(`✅ Card generated: ${file}`);
  console.log(`   Size: ${SIZES[type]?.w || 1200}x${SIZES[type]?.h || 630}`);
  console.log(`   Type: ${type}`);
  console.log(`\n💡 To convert to PNG, use: npx svgexport ${file} ${file.replace('.svg', '.png')} ${SIZES[type]?.w || 1200}:${SIZES[type]?.h || 630}`);
}

main();
