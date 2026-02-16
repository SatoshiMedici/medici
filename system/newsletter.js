#!/usr/bin/env node
/**
 * MEDICI Newsletter Tool
 * Send HTML newsletters via Resend to a subscriber list.
 *
 * Usage:
 *   node newsletter.js send --subject "Subject" --content content.md
 *   node newsletter.js send --subject "Subject" --content content.md --test mario@email.com
 *   node newsletter.js subscribers list
 *   node newsletter.js subscribers add "name@email.com"
 *   node newsletter.js subscribers remove "name@email.com"
 */

const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);
const SUBS_FILE = path.join(__dirname, '..', 'system', 'subscribers.json');

function loadSubscribers() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
}

function saveSubscribers(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

function markdownToHtml(md) {
  // Simple markdown to HTML
  let html = md
    .replace(/^### (.+)$/gm, '<h3 style="color:#C9A84C;font-family:Georgia,serif;margin-top:28px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#C9A84C;font-family:Georgia,serif;margin-top:32px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#C9A84C;font-family:Georgia,serif;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#C9A84C;">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:12px 0;">$&</ul>')
    .replace(/^(?!<[hulo]|<li|<str|<em|<a)(.+)$/gm, '<p style="margin:12px 0;line-height:1.7;color:#444;">$1</p>')
    .replace(/\n{2,}/g, '');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;font-size:16px;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #C9A84C;">
      <h1 style="font-family:Georgia,serif;font-size:28px;color:#C9A84C;letter-spacing:0.15em;margin:0;">MEDICI</h1>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">Growth, engineered.</p>
    </div>
    <!-- Content -->
    ${html}
    <!-- Footer -->
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E0E0E0;text-align:center;">
      <p style="color:#999;font-size:12px;margin:0;">
        MEDICI · <a href="https://medici.codes" style="color:#C9A84C;">medici.codes</a> · 
        <a href="https://x.com/MediciCodes" style="color:#C9A84C;">@MediciCodes</a>
      </p>
      <p style="color:#BBB;font-size:11px;margin-top:8px;">
        You're receiving this because you subscribed to the MEDICI newsletter.
        <a href="mailto:info@medici.codes?subject=Unsubscribe" style="color:#999;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
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

async function sendNewsletter(subject, contentFile, testEmail) {
  if (!fs.existsSync(contentFile)) {
    console.error(`File not found: ${contentFile}`);
    process.exit(1);
  }

  const md = fs.readFileSync(contentFile, 'utf-8');
  const html = markdownToHtml(md);

  const recipients = testEmail ? [testEmail] : loadSubscribers().map(s => s.email);

  if (recipients.length === 0) {
    console.error('No recipients. Add subscribers or use --test email@example.com');
    process.exit(1);
  }

  console.log(`📧 Sending "${subject}" to ${recipients.length} recipient(s)...\n`);

  let sent = 0, failed = 0;
  // Send individually for personalization potential
  for (const to of recipients) {
    try {
      const result = await resend.emails.send({
        from: 'MEDICI Newsletter <info@medici.codes>',
        to: [to],
        subject: subject,
        html: html,
      });
      if (result.error) {
        console.error(`  ❌ ${to}: ${result.error.message}`);
        failed++;
      } else {
        console.log(`  ✅ ${to}`);
        sent++;
      }
    } catch (err) {
      console.error(`  ❌ ${to}: ${err.message}`);
      failed++;
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 Sent: ${sent} | Failed: ${failed}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'send') {
    const opts = parseArgs(args.slice(1));
    if (!opts.subject || !opts.content) {
      console.error('Required: --subject "Subject" --content file.md');
      process.exit(1);
    }
    await sendNewsletter(opts.subject, opts.content, opts.test || null);

  } else if (command === 'subscribers') {
    const sub = args[1];
    const subs = loadSubscribers();

    if (sub === 'list') {
      if (subs.length === 0) { console.log('No subscribers.'); return; }
      subs.forEach(s => console.log(`  ${s.email} (added: ${s.addedAt})`));
      console.log(`\nTotal: ${subs.length}`);

    } else if (sub === 'add') {
      const email = args[2];
      if (!email) { console.error('Usage: node newsletter.js subscribers add email'); process.exit(1); }
      if (subs.find(s => s.email === email)) { console.log('Already subscribed.'); return; }
      subs.push({ email, addedAt: new Date().toISOString() });
      saveSubscribers(subs);
      console.log(`✅ Added: ${email}`);

    } else if (sub === 'remove') {
      const email = args[2];
      const filtered = subs.filter(s => s.email !== email);
      saveSubscribers(filtered);
      console.log(`🗑️ Removed: ${email}`);

    } else {
      console.log('Usage: node newsletter.js subscribers [list|add|remove]');
    }

  } else {
    console.log('Usage:');
    console.log('  node newsletter.js send --subject "Subject" --content file.md [--test email]');
    console.log('  node newsletter.js subscribers [list|add email|remove email]');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
