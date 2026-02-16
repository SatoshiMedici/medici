#!/usr/bin/env node
/**
 * MEDICI Video Ad Generator
 * Renders frames with Sharp (SVG overlay), stitches with FFmpeg.
 *
 * Templates: intro, kinetic, testimonial
 */

const { execSync } = require('child_process');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'videos');
const W = 1920, H = 1080, FPS = 25;
const GOLD = '#C9A84C';

function parseArgs(args) {
  const parsed = { texts: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--texts') {
      i++;
      while (i < args.length && !args[i].startsWith('--')) { parsed.texts.push(args[i]); i++; }
      i--;
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1]; i++;
    }
  }
  return parsed;
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function fadeIn(t, start, dur) { return t < start ? 0 : Math.min(1, (t - start) / dur); }
function fadeOut(t, start, dur) { return t < start ? 1 : Math.max(0, 1 - (t - start) / dur); }

function frameSVG(elements) {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0A0A0A"/>
  <rect width="${W}" height="4" fill="${GOLD}" y="0"/>
  ${elements.join('\n  ')}
  </svg>`;
}

function textEl(text, x, y, size, color, opacity, anchor = 'middle', weight = 'normal', font = 'Georgia, serif') {
  if (opacity <= 0) return '';
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" opacity="${opacity.toFixed(3)}" text-anchor="${anchor}">${esc(text)}</text>`;
}

async function renderFrame(svg, frameDir, frameNum) {
  const buf = Buffer.from(svg);
  const padded = String(frameNum).padStart(6, '0');
  await sharp(buf).png({ quality: 80, compressionLevel: 6 }).toFile(path.join(frameDir, `frame_${padded}.png`));
}

async function framesToVideo(frameDir, outFile, dur) {
  const cmd = `ffmpeg -y -framerate ${FPS} -i "${frameDir}/frame_%06d.png" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 20 -t ${dur} "${outFile}" 2>&1`;
  execSync(cmd, { maxBuffer: 20 * 1024 * 1024 });
}

function cleanup(frameDir) {
  const files = fs.readdirSync(frameDir).filter(f => f.startsWith('frame_'));
  files.forEach(f => fs.unlinkSync(path.join(frameDir, f)));
  fs.rmdirSync(frameDir);
}

/**
 * Template: Intro
 */
async function templateIntro(opts) {
  const { headline = 'Growth, engineered.', subtitle = 'medici.codes', duration = '6' } = opts;
  const dur = parseInt(duration);
  const totalFrames = dur * FPS;
  const out = path.join(OUTPUT_DIR, `intro-${Date.now()}.mp4`);
  const frameDir = path.join(OUTPUT_DIR, `_frames_${Date.now()}`);
  ensureDir(frameDir);

  console.log(`  Rendering ${totalFrames} frames...`);
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS;
    const globalFade = fadeOut(t, dur - 0.5, 0.5);

    const els = [
      textEl(headline, W/2, H/2 - 20, 72, 'white', fadeIn(t, 0.8, 0.6) * globalFade, 'middle', 'normal', 'Georgia, serif'),
      textEl(subtitle, W/2, H/2 + 60, 28, '#AAAAAA', fadeIn(t, 1.8, 0.6) * globalFade, 'middle', 'normal', 'Inter, sans-serif'),
      textEl('MEDICI', W/2, H - 80, 24, GOLD, fadeIn(t, 3, 0.5) * globalFade, 'middle', 'normal', 'Georgia, serif'),
      textEl('medici.codes', W/2, H - 50, 16, '#666666', fadeIn(t, 3.3, 0.5) * globalFade),
    ];

    await renderFrame(frameSVG(els), frameDir, i);
    if (i % 25 === 0) process.stdout.write(`  ${Math.round(i/totalFrames*100)}%\r`);
  }

  console.log('  Encoding video...');
  await framesToVideo(frameDir, out, dur);
  cleanup(frameDir);
  return out;
}

/**
 * Template: Kinetic Typography
 */
async function templateKinetic(opts) {
  const { texts, duration = '8' } = opts;
  if (!texts || texts.length === 0) { console.error('--texts required'); process.exit(1); }

  const dur = parseInt(duration);
  const totalFrames = dur * FPS;
  const out = path.join(OUTPUT_DIR, `kinetic-${Date.now()}.mp4`);
  const frameDir = path.join(OUTPUT_DIR, `_frames_${Date.now()}`);
  ensureDir(frameDir);

  const interval = (dur - 1) / texts.length;

  console.log(`  Rendering ${totalFrames} frames...`);
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS;
    const globalFade = fadeOut(t, dur - 0.5, 0.5);
    const els = [];

    texts.forEach((text, idx) => {
      const st = idx * interval + 0.3;
      const en = st + interval;
      const isLast = idx === texts.length - 1;

      let alpha = 0;
      if (t >= st && t < st + 0.2) alpha = easeOut((t - st) / 0.2);
      else if (t >= st + 0.2 && t < en - 0.15) alpha = 1;
      else if (t >= en - 0.15 && t < en) alpha = 1 - (t - (en - 0.15)) / 0.15;

      const yOffset = t >= st && t < st + 0.2 ? lerp(20, 0, easeOut((t - st) / 0.2)) : 0;

      els.push(textEl(
        text, W/2, H/2 + 20 + yOffset,
        isLast ? 80 : 64,
        isLast ? GOLD : 'white',
        alpha * globalFade,
        'middle', isLast ? 'bold' : 'normal', 'Georgia, serif'
      ));
    });

    els.push(textEl('MEDICI', W - 60, H - 40, 18, GOLD, 0.5 * globalFade, 'end'));

    await renderFrame(frameSVG(els), frameDir, i);
    if (i % 25 === 0) process.stdout.write(`  ${Math.round(i/totalFrames*100)}%\r`);
  }

  console.log('  Encoding video...');
  await framesToVideo(frameDir, out, dur);
  cleanup(frameDir);
  return out;
}

/**
 * Template: Testimonial / Quote
 */
async function templateTestimonial(opts) {
  const { headline, body, cta, duration = '7' } = opts;
  const dur = parseInt(duration);
  const totalFrames = dur * FPS;
  const out = path.join(OUTPUT_DIR, `testimonial-${Date.now()}.mp4`);
  const frameDir = path.join(OUTPUT_DIR, `_frames_${Date.now()}`);
  ensureDir(frameDir);

  console.log(`  Rendering ${totalFrames} frames...`);
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS;
    const globalFade = fadeOut(t, dur - 0.5, 0.5);
    const els = [];

    // Gold accent bar
    const barAlpha = fadeIn(t, 0.4, 0.3) * globalFade;
    if (barAlpha > 0) {
      els.push(`<rect x="80" y="320" width="4" height="160" fill="${GOLD}" opacity="${barAlpha.toFixed(3)}"/>`);
    }

    els.push(textEl(headline, 120, 380, 52, 'white', fadeIn(t, 0.8, 0.6) * globalFade, 'start', 'normal', 'Georgia, serif'));
    if (body) els.push(textEl(body, 120, 440, 26, '#AAAAAA', fadeIn(t, 1.5, 0.6) * globalFade, 'start'));

    // CTA button
    if (cta) {
      const ctaAlpha = fadeIn(t, 2.8, 0.4) * globalFade;
      if (ctaAlpha > 0) {
        els.push(`<rect x="120" y="500" width="280" height="52" rx="26" fill="${GOLD}" opacity="${ctaAlpha.toFixed(3)}"/>`);
        els.push(textEl(cta, 260, 532, 20, '#0A0A0A', ctaAlpha, 'middle', 'bold', 'Inter, sans-serif'));
      }
    }

    els.push(textEl('MEDICI', W - 60, H - 40, 20, GOLD, 0.5 * globalFade, 'end'));

    await renderFrame(frameSVG(els), frameDir, i);
    if (i % 25 === 0) process.stdout.write(`  ${Math.round(i/totalFrames*100)}%\r`);
  }

  console.log('  Encoding video...');
  await framesToVideo(frameDir, out, dur);
  cleanup(frameDir);
  return out;
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.template) {
    console.log('MEDICI Video Ad Generator\n');
    console.log('Templates:');
    console.log('  intro        Brand reveal — headline + subtitle fade in');
    console.log('  kinetic      Kinetic typography — words slam in sequence');
    console.log('  testimonial  Quote card with CTA button');
    console.log('\nExamples:');
    console.log('  node video-ad.js --template intro --headline "Growth, engineered." --subtitle "medici.codes"');
    console.log('  node video-ad.js --template kinetic --texts "AI-First" "10x Output" "Growth, engineered."');
    console.log('  node video-ad.js --template testimonial --headline "10x faster" --body "AI-powered" --cta "Book a call"');
    process.exit(0);
  }

  console.log(`🎬 Generating ${opts.template} video...`);
  let outFile;

  switch (opts.template) {
    case 'intro': outFile = await templateIntro(opts); break;
    case 'kinetic': outFile = await templateKinetic(opts); break;
    case 'testimonial': outFile = await templateTestimonial(opts); break;
    default: console.error(`Unknown template: ${opts.template}`); process.exit(1);
  }

  const stats = fs.statSync(outFile);
  console.log(`\n✅ Video saved: ${outFile}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

main();
