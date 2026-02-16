#!/usr/bin/env node
/**
 * MEDICI X Posting Tool
 * Usage:
 *   node x-post.js "Your tweet text here"
 *   node x-post.js --thread "Tweet 1" "Tweet 2" "Tweet 3"
 *   node x-post.js --dry-run "Test tweet"
 */

const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

async function postTweet(text) {
  const result = await rwClient.v2.tweet(text);
  console.log(`✅ Posted: https://x.com/MediciCodes/status/${result.data.id}`);
  return result.data;
}

async function postThread(tweets) {
  let lastId = null;
  for (let i = 0; i < tweets.length; i++) {
    const opts = lastId ? { reply: { in_reply_to_tweet_id: lastId } } : {};
    const result = await rwClient.v2.tweet(tweets[i], opts);
    lastId = result.data.id;
    console.log(`✅ ${i + 1}/${tweets.length}: https://x.com/MediciCodes/status/${result.data.id}`);
  }
  console.log(`\n🧵 Thread posted (${tweets.length} tweets)`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node x-post.js "tweet text"');
    console.error('       node x-post.js --thread "tweet 1" "tweet 2" ...');
    console.error('       node x-post.js --dry-run "tweet text"');
    process.exit(1);
  }

  const isDryRun = args[0] === '--dry-run';
  const isThread = args[0] === '--thread';

  if (isDryRun) {
    const text = args.slice(1).join(' ');
    console.log(`🔍 DRY RUN — would post:\n"${text}"\n(${text.length} chars)`);
    return;
  }

  if (isThread) {
    const tweets = args.slice(1);
    if (tweets.length < 2) {
      console.error('Thread needs at least 2 tweets');
      process.exit(1);
    }
    console.log(`🧵 Posting thread (${tweets.length} tweets)...\n`);
    await postThread(tweets);
  } else {
    const text = args.join(' ');
    if (text.length > 280) {
      console.error(`❌ Tweet too long: ${text.length}/280 chars`);
      process.exit(1);
    }
    await postTweet(text);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  if (err.data) console.error('Details:', JSON.stringify(err.data, null, 2));
  process.exit(1);
});
