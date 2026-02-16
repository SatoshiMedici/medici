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
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
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
          // Find image part in response
          const parts = json.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(p => p.inlineData);
          if (imagePart) {
            resolve({
              data: Buffer.from(imagePart.inlineData.data, 'base64'),
              mimeType: imagePart.inlineData.mimeType,
            });
          } else {
            const textPart = parts.find(p => p.text);
            reject(new Error(textPart?.text || 'No image generated'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
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
    const { data, mimeType } = await geminiRequest(fullPrompt);
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
