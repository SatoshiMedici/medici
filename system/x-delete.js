#!/usr/bin/env node
/**
 * Delete a tweet by ID
 * Usage: node x-delete.js <tweet-id>
 */
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function main() {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node x-delete.js <tweet-id>'); process.exit(1); }
  await client.readWrite.v2.deleteTweet(id);
  console.log(`🗑️ Deleted tweet ${id}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
