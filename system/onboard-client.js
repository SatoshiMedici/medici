#!/usr/bin/env node
/**
 * MEDICI Client Onboarding
 * Creates the full client directory structure from the template.
 *
 * Usage:
 *   node onboard-client.js <client-slug>
 *   node onboard-client.js acme-corp
 */

const fs = require('fs');
const path = require('path');

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');
const TEMPLATE = path.join(__dirname, 'CLIENT-TEMPLATE.md');

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node onboard-client.js <client-slug>');
    console.error('Example: node onboard-client.js acme-corp');
    process.exit(1);
  }

  const clientDir = path.join(CLIENTS_DIR, slug);
  if (fs.existsSync(clientDir)) {
    console.error(`❌ Client "${slug}" already exists at ${clientDir}`);
    process.exit(1);
  }

  // Create directory structure
  const dirs = [
    clientDir,
    path.join(clientDir, 'content', 'drafts'),
    path.join(clientDir, 'content', 'ideas'),
    path.join(clientDir, 'content', 'analytics'),
    path.join(clientDir, 'content', 'outreach'),
    path.join(clientDir, 'content', 'approved'),
    path.join(clientDir, 'content', 'seo'),
    path.join(clientDir, 'competitor-reports'),
    path.join(clientDir, 'reports'),
    path.join(clientDir, 'assets'),
  ];

  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  // Copy profile template
  if (fs.existsSync(TEMPLATE)) {
    const template = fs.readFileSync(TEMPLATE, 'utf-8')
      .replace('# Client Profile Template\n\nCopy this to `clients/{name}/PROFILE.md` for each new client.\n\n---\n', '');
    fs.writeFileSync(path.join(clientDir, 'PROFILE.md'), template);
  }

  // Create scope file
  fs.writeFileSync(path.join(clientDir, 'SCOPE.md'), `# ${slug} — Active Scope\n\n## Phase: Onboarding\n\n### Deliverables\n- [ ] Brand voice guide\n- [ ] Content strategy\n- [ ] Channel setup\n- [ ] First week content\n\n### Weekly Rhythm\n- TBD after discovery call\n\n### Success Metrics\n- TBD\n`);

  // Create status file
  fs.writeFileSync(path.join(clientDir, 'STATUS.md'), `# ${slug} — Status\n\n**Last updated:** ${new Date().toISOString().split('T')[0]}\n**Stage:** Onboarding\n**Health:** 🟢\n\n## Current Focus\n- Initial setup and discovery\n\n## Blockers\n- None\n\n## Notes\n`);

  // Create empty competitors file
  fs.writeFileSync(path.join(clientDir, 'competitors.json'), '[]');

  console.log(`✅ Client "${slug}" onboarded!\n`);
  console.log('Directory structure:');
  console.log(`  ${clientDir}/`);
  console.log('  ├── PROFILE.md        ← Fill in client details');
  console.log('  ├── SCOPE.md          ← Define deliverables');
  console.log('  ├── STATUS.md         ← Track current state');
  console.log('  ├── competitors.json  ← Track competitors');
  console.log('  ├── content/');
  console.log('  │   ├── drafts/       ← Content drafts');
  console.log('  │   ├── ideas/        ← Research ideas');
  console.log('  │   ├── analytics/    ← Performance reports');
  console.log('  │   ├── outreach/     ← Outreach campaigns');
  console.log('  │   ├── approved/     ← Approved content');
  console.log('  │   └── seo/          ← SEO research');
  console.log('  ├── competitor-reports/');
  console.log('  ├── reports/          ← Weekly/monthly reports');
  console.log('  └── assets/           ← Brand assets');
  console.log('\nNext: Fill in PROFILE.md after the discovery call.');
}

main();
