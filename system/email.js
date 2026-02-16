#!/usr/bin/env node
/**
 * MEDICI Email Tool
 * Usage:
 *   node email.js send --to "name@example.com" --subject "Hello" --body "Message here"
 *   node email.js send --to "name@example.com" --subject "Hello" --html "<h1>Hello</h1>"
 *   node email.js send --to "name@example.com" --subject "Hello" --body "Message" --from "mario@medici.codes"
 *   node email.js test
 */

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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

async function sendEmail(opts) {
  const result = await resend.emails.send({
    from: opts.from || 'MEDICI <info@medici.codes>',
    to: [opts.to],
    subject: opts.subject,
    text: opts.body || undefined,
    html: opts.html || undefined,
  });

  if (result.error) {
    console.error('❌ Error:', result.error.message);
    process.exit(1);
  }

  console.log(`✅ Email sent to ${opts.to} (id: ${result.data.id})`);
  return result;
}

async function testEmail() {
  // Send to Resend's test address
  const result = await resend.emails.send({
    from: 'MEDICI <info@medici.codes>',
    to: ['delivered@resend.dev'],
    subject: 'MEDICI Email System Test',
    text: 'If you see this, the MEDICI email system is working.\n\n— MEDICI\nGrowth, engineered.\nmedici.codes',
  });

  if (result.error) {
    console.error('❌ Error:', result.error.message);
    console.error('Details:', JSON.stringify(result.error, null, 2));
    process.exit(1);
  }

  console.log(`✅ Test email sent (id: ${result.data.id})`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage:');
    console.log('  node email.js test');
    console.log('  node email.js send --to "email" --subject "Subject" --body "Body"');
    process.exit(0);
  }

  if (command === 'test') {
    await testEmail();
  } else if (command === 'send') {
    const opts = parseArgs(args.slice(1));
    if (!opts.to || !opts.subject) {
      console.error('Required: --to and --subject');
      process.exit(1);
    }
    if (!opts.body && !opts.html) {
      console.error('Required: --body or --html');
      process.exit(1);
    }
    await sendEmail(opts);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
