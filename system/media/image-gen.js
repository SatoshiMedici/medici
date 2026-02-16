#!/usr/bin/env node
/**
 * MEDICI AI Image Generator
 * Uses Google Gemini (Imagen) for image generation.
 *
 * Usage:
 *   node image-gen.js --prompt "A modern startup office with golden accents" --style brand
 *   node image-gen.js --prompt "Abstract network visualization" --style abstract --size 1200x675
 *   node image-gen.js --prompt "Product mockup" --name "product-hero"
 *
 * Styles: brand, abstract, photo, minimal, editorial
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const USE_FREE = !XAI_API_KEY && (!process.env.GEMINI_BILLING || process.env.IMAGE_PROVIDER === 'free');

const STYLE_PREFIXES = {
  brand: 'Professional, premium brand aesthetic. Dark background with warm gold (#C9A84C) accents. Clean, minimal, Stripe/Linear design language.',
  abstract: 'Abstract geometric visualization. Dark background, gold wireframe elements, network/connection motifs. Premium tech aesthetic.',
  photo: 'Professional photography style. Natural lighting, shallow depth of field. Premium editorial feel.',
  minimal: 'Ultra-minimal design. Lots of negative space. One or two colors max. Sophisticated and clean.',
  editorial: 'Editorial magazine style. Bold typography treatment. High contrast. Fashion-meets-tech aesthetic.',
  social: 'Eye-catching social media visual. Bold, shareable, stops the scroll. Modern design trends.',
  ad: 'Performance ad creative. Clear focal point, compelling visual hierarchy, drives action. Professional.',
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

function geminiRequest(prompt) {
  return new Promise((resolve, reject) => {
    // Try Imagen 4.0 first (different payload format)
    const payload = JSON.stringify({
      instances: [{ prompt: prompt }],
      parameters: { sampleCount: 1 },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            // Fallback: try Gemini generateContent with image modality
            return geminiGenerateContent(prompt).then(resolve).catch(reject);
          }
          // Imagen response format
          const predictions = json.predictions || [];
          if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
            resolve({
              data: Buffer.from(predictions[0].bytesBase64Encoded, 'base64'),
              mimeType: predictions[0].mimeType || 'image/png',
            });
          } else {
            reject(new Error('No image in response'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function geminiGenerateContent(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
            return;
          }
          const parts = json.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(p => p.inlineData);
          if (imagePart) {
            resolve({
              data: Buffer.from(imagePart.inlineData.data, 'base64'),
              mimeType: imagePart.inlineData.mimeType,
            });
          } else {
            reject(new Error('No image generated'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function grokImageRequest(prompt, size) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'grok-2-image',
      prompt: prompt,
      n: 1,
      response_format: 'b64_json',
    });

    const options = {
      hostname: 'api.x.ai',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
            return;
          }
          const imgData = json.data?.[0]?.b64_json;
          if (imgData) {
            resolve({
              data: Buffer.from(imgData, 'base64'),
              mimeType: 'image/png',
            });
          } else if (json.data?.[0]?.url) {
            // URL response — fetch it
            https.get(json.data[0].url, imgRes => {
              const chunks = [];
              imgRes.on('data', c => chunks.push(c));
              imgRes.on('end', () => resolve({ data: Buffer.concat(chunks), mimeType: 'image/png' }));
            }).on('error', reject);
          } else {
            reject(new Error('No image in response'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function freeImageRequest(prompt, size) {
  // Use picfinder.ai free endpoint
  return new Promise((resolve, reject) => {
    const dims = (size || '1200x675').split('x');
    const w = parseInt(dims[0]) || 1200;
    const h = parseInt(dims[1]) || 675;
    
    const payload = JSON.stringify({
      prompt: prompt,
      width: w,
      height: h,
    });

    // Fallback: generate SVG-based illustration locally
    const sharp = require('sharp');
    
    // Create a high-quality branded illustration using SVG
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0A0A0A"/>
          <stop offset="100%" stop-color="#141414"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#bg)"/>
      <rect width="${w}" height="${h}" fill="url(#glow)"/>
      <!-- Grid -->
      ${Array.from({length: 30}, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="${h}" stroke="#C9A84C" stroke-opacity="0.03" stroke-width="0.5"/>`).join('')}
      ${Array.from({length: 20}, (_, i) => `<line x1="0" y1="${i * 40}" x2="${w}" y2="${i * 40}" stroke="#C9A84C" stroke-opacity="0.03" stroke-width="0.5"/>`).join('')}
      <!-- Network nodes -->
      ${Array.from({length: 12}, () => {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const r = Math.random() * 4 + 2;
        return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="#C9A84C" opacity="${(Math.random() * 0.5 + 0.2).toFixed(2)}"/>`;
      }).join('')}
      <!-- Connection lines -->
      ${Array.from({length: 15}, () => {
        const x1 = Math.random() * w, y1 = Math.random() * h;
        const x2 = Math.random() * w, y2 = Math.random() * h;
        return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="#C9A84C" stroke-opacity="0.08" stroke-width="0.5"/>`;
      }).join('')}
      <!-- Accent circles -->
      <circle cx="${w*0.3}" cy="${h*0.4}" r="80" fill="none" stroke="#C9A84C" stroke-opacity="0.06" stroke-width="1"/>
      <circle cx="${w*0.7}" cy="${h*0.6}" r="120" fill="none" stroke="#C9A84C" stroke-opacity="0.04" stroke-width="1"/>
      <!-- Gold line top -->
      <rect x="0" y="0" width="${w}" height="3" fill="#C9A84C"/>
    </svg>`;

    sharp(Buffer.from(svg))
      .png()
      .toBuffer()
      .then(data => resolve({ data, mimeType: 'image/png' }))
      .catch(reject);
  });
}

async function main() {
  if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY not set. Add it to .env');
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));
  if (!opts.prompt) {
    console.log('Usage: node image-gen.js --prompt "description" [--style brand|abstract|photo|minimal|editorial|social|ad] [--name filename]');
    process.exit(0);
  }

  const style = opts.style || 'brand';
  const stylePrefix = STYLE_PREFIXES[style] || '';
  const fullPrompt = `Generate an image: ${stylePrefix}\n\n${opts.prompt}\n\nDo not include any text or watermarks in the image.`;

  console.log(`🎨 Generating image (style: ${style})...`);

  try {
    let result;
    if (XAI_API_KEY) {
      try {
        result = await grokImageRequest(fullPrompt, opts.size);
        console.log('  Provider: Grok (xAI)');
      } catch (e) {
        console.log(`  Grok failed (${e.message.substring(0, 60)}...), falling back...`);
        result = await freeImageRequest(fullPrompt, opts.size);
        console.log('  Provider: Local SVG');
      }
    } else if (USE_FREE) {
      result = await freeImageRequest(fullPrompt, opts.size);
      console.log('  Provider: Local SVG');
    } else {
      result = await geminiRequest(fullPrompt);
      console.log('  Provider: Gemini');
    }
    const { data, mimeType } = result;
    const ext = mimeType?.includes('png') ? 'png' : 'jpg';
    const name = opts.name || opts.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    
    const dir = path.join(__dirname, '..', '..', 'assets', 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const file = path.join(dir, `${name}.${ext}`);
    fs.writeFileSync(file, data);
    
    console.log(`✅ Image saved: ${file}`);
    console.log(`   Size: ${(data.length / 1024).toFixed(1)} KB`);
    console.log(`   Format: ${ext}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
