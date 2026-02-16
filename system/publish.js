#!/usr/bin/env node
/**
 * MEDICI Publish Tool
 * Reads a draft file, shows content for review, posts approved items to X.
 *
 * Usage:
 *   node publish.js                    # Today's drafts
 *   node publish.js 2026-02-17         # Specific date
 *   node publish.js --list             # List all draft files
 *   node publish.js --status           # Show draft statuses
 */

const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const DRAFTS_DIR = path.join(__dirname, '..', 'content', 'drafts');

const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = client.readWrite;

function getDate() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) { console.log('No drafts directory.'); return; }
  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')).sort();
  if (files.length === 0) { console.log('No draft files found.'); return; }
  files.forEach(f => {
    const content = fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf-8');
    const ready = (content.match(/\[READY FOR REVIEW\]/g) || []).length;
    const approved = (content.match(/\[APPROVED\]/g) || []).length;
    const published = (content.match(/\[PUBLISHED\]/g) || []).length;
    console.log(`📄 ${f} — ${ready} ready, ${approved} approved, ${published} published`);
  });
}

function parseDrafts(content) {
  // Split by horizontal rules or ## headers to find individual pieces
  const pieces = [];
  const sections = content.split(/(?=^## )/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const platformMatch = section.match(/\[(X|LINKEDIN)\]/);
    const typeMatch = section.match(/\[(POST|THREAD|LONGFORM)\]/);
    const statusMatch = section.match(/\[(READY FOR REVIEW|APPROVED|PUBLISHED|NEEDS REVISION)\]/);

    if (!platformMatch) continue;

    // Extract the actual content (lines that aren't metadata tags)
    const lines = section.split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim();
    const contentLines = lines.slice(1)
      .filter(l => !l.match(/^\**(Platform|Type|Pillar|Status).*\[/))
      .filter(l => l.trim() !== '---')
      .join('\n').trim();

    pieces.push({
      title,
      platform: platformMatch[1],
      type: typeMatch ? typeMatch[1] : 'POST',
      status: statusMatch ? statusMatch[1] : 'READY FOR REVIEW',
      content: contentLines,
      raw: section,
    });
  }
  return pieces;
}

async function postToX(text) {
  if (text.length > 280) {
    console.error(`  ❌ Too long (${text.length}/280). Skipping.`);
    return null;
  }
  const result = await rwClient.v2.tweet(text);
  return `https://x.com/MediciCodes/status/${result.data.id}`;
}

async function postThreadToX(tweets) {
  let lastId = null;
  const urls = [];
  for (let i = 0; i < tweets.length; i++) {
    const opts = lastId ? { reply: { in_reply_to_tweet_id: lastId } } : {};
    const result = await rwClient.v2.tweet(tweets[i], opts);
    lastId = result.data.id;
    urls.push(`https://x.com/MediciCodes/status/${result.data.id}`);
  }
  return urls;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list' || args[0] === '--status') {
    listDrafts();
    return;
  }

  const date = args[0] || getDate();
  const draftFile = path.join(DRAFTS_DIR, `${date}.md`);

  if (!fs.existsSync(draftFile)) {
    console.log(`No drafts for ${date}. Use --list to see available files.`);
    return;
  }

  const content = fs.readFileSync(draftFile, 'utf-8');
  const pieces = parseDrafts(content);

  if (pieces.length === 0) {
    console.log(`No parseable content in ${date}.md`);
    return;
  }

  console.log(`\n📋 Drafts for ${date}:\n`);
  pieces.forEach((p, i) => {
    const statusIcon = p.status === 'APPROVED' ? '✅' : p.status === 'PUBLISHED' ? '📤' : p.status === 'NEEDS REVISION' ? '🔄' : '📝';
    console.log(`${statusIcon} [${i + 1}] ${p.title}`);
    console.log(`   Platform: ${p.platform} | Type: ${p.type} | Status: ${p.status}`);
    console.log(`   Preview: ${p.content.substring(0, 100)}...`);
    console.log();
  });

  // Auto-publish approved X posts
  const toPublish = pieces.filter(p => p.status === 'APPROVED' && p.platform === 'X');
  if (toPublish.length === 0) {
    console.log('No approved X content to publish. Mark items [APPROVED] in the draft file to publish.');
    return;
  }

  console.log(`\n🚀 Publishing ${toPublish.length} approved X item(s)...\n`);

  let updatedContent = content;
  for (const piece of toPublish) {
    try {
      if (piece.type === 'THREAD') {
        // Split thread by numbered lines
        const tweets = piece.content.split(/\n\d+\/\s*/).filter(t => t.trim());
        const urls = await postThreadToX(tweets);
        console.log(`  🧵 Thread posted (${urls.length} tweets): ${urls[0]}`);
      } else {
        const url = await postToX(piece.content);
        if (url) console.log(`  ✅ Posted: ${url}`);
      }
      updatedContent = updatedContent.replace('[APPROVED]', '[PUBLISHED]');
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
  }

  fs.writeFileSync(draftFile, updatedContent);
  console.log(`\n✅ Draft file updated.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
