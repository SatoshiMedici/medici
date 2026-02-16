# MEDICI Execution System — Architecture

## Overview
Multi-agent marketing infrastructure that powers Medici's service delivery.
Each agent owns a pillar and operates on automated cycles.

## Agents

| Agent | Pillar | Cycle | Cron |
|-------|--------|-------|------|
| Research & Intelligence | Market scanning, trends, competitor intel | Daily 7:00 | ✅ |
| Content Engine | Drafts, formatting, brand voice | Daily 8:00 | ✅ |
| Analytics & Reporting | Performance tracking, insights | Weekly Mon 9:00 | ✅ |
| Outreach & Distribution | Lead gen, cold email, partnerships | Daily 9:30 | ✅ |
| Strategy (Jarvis) | Orchestration, QC, client comms | Always-on | Main session |

## Data Flow
```
Research → ideas/{date}.md
              ↓
Content Engine → drafts/{date}.md
              ↓
Mario reviews → approved/ or feedback
              ↓
Distribution → scheduled posts + outreach
              ↓
Analytics ← platform metrics → reports/{date}.md
              ↓
Strategy adjusts → next cycle inputs
```

## Client System
Each client gets a profile in `clients/{name}/`:
- `PROFILE.md` — brand voice, goals, audience, competitors
- `SCOPE.md` — active engagement scope and deliverables
- `STATUS.md` — current state, what's active, blockers
- `content/` — client-specific content drafts and approvals

## Quality Control
- All content passes through Mario for approval before publishing
- Analytics agent flags underperformance automatically
- Strategy agent (Jarvis) reviews all outputs in main session
- Weekly strategy review with Mario

## File Conventions
- Dates: YYYY-MM-DD
- Drafts tagged: [READY FOR REVIEW] / [APPROVED] / [PUBLISHED] / [NEEDS REVISION]
- Ideas scored: 🔥 (high potential) / ✅ (solid) / 💡 (explore)
