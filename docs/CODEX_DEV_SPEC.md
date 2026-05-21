# Bug Hunter Replay Development Spec

## Product Positioning

Bug Hunter Replay is a Playwright-based Web bug auto-exploration CLI. Its core command is:

```bash
bug-hunter run <url>
```

The MVP flow is:

```text
bug-hunter run <url>
→ automatically discover page interactions
→ capture Console Error / Page Error / Network Error / HTTP 4xx/5xx / Slow Request / Blank Page
→ take screenshots before and after actions
→ generate report.md / report.html / report.json
→ generate repro.spec.ts
```

## MVP Scope

In scope:

- Node.js 20+ CLI
- TypeScript
- pnpm
- Commander
- Vitest
- ESLint
- Prettier
- Playwright dependency from the start
- `bug-hunter run <url>` as the primary command
- local-only exploration and reporting
- `reports/<run-id>/` output directories
- fully offline `report.html` in later milestones, with inline CSS/JS and no CDN dependency
- conservative exploration rules
- slow request default threshold: `3000ms`

Out of scope for the MVP:

- `record` command
- `replay` command
- scenario JSON record/replay system
- Chrome extension
- Web Dashboard
- cloud platform
- account system
- AI features
- security scanning
- vulnerability exploitation
- attack payload generation
- destructive form submission
- unknown-form submission by default

## Safety Rules

The MVP performs passive error capture and conservative UI exploration only. It must not become a security scanner or exploitation tool.

Default exploration rules:

- same-origin-only
- bounded by `maxDepth` and `maxActions`
- skip dangerous-looking actions
- do not submit unknown forms by default
- allow controlled form submission only when explicitly limited to safe demo fixtures or future safety rules

## Output Directory Standard

Each run writes to:

```text
reports/<run-id>/
```

Expected final MVP contents:

```text
reports/<run-id>/
├── report.md
├── report.html
├── report.json
├── repro.spec.ts
├── screenshots/
└── traces/
    └── trace.zip
```

`trace.zip` is optional and controlled by runtime configuration.

## Milestone Plan

### Milestone 0: Project Skeleton

- Initialize TypeScript + pnpm CLI project.
- Configure Commander, Vitest, ESLint, Prettier, and TypeScript.
- Install Playwright dependency without implementing browser startup logic.
- Create `docs/CODEX_DEV_SPEC.md`.
- Create minimal CLI help and version output.

Acceptance:

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm dev -- --help
```

### Milestone 1: `bug-hunter run <url>` Foundation

- Implement argument parsing for `bug-hunter run <url>`.
- Create `reports/<run-id>/`.
- Write a basic `report.json`.
- Do not implement exploration yet.

### Milestone 2: Playwright Page Visit and Event Capture

- Open the target URL with Playwright.
- Capture `console.error`, `pageerror`, `requestfailed`, HTTP `4xx/5xx`, network timings, screenshots, and network events.

### Milestone 3: Action Discovery and Safe Exploration

- Discover safe interactive elements.
- Apply same-origin-only rules.
- Apply dangerous-action filtering.
- Respect `maxDepth` and `maxActions`.
- Use bounded BFS.
- Capture screenshots before and after actions.

### Milestone 4: Issue Analyzer

- Analyze raw events into deduplicated issues.
- Support severity.
- Detect Console Error, Page Error, Network Error, HTTP 4xx/5xx, Slow Request, and Blank Page.

### Milestone 5: Reports

- Generate `report.md`.
- Generate fully offline `report.html` with inline assets.
- Generate `report.json`.

### Milestone 6: Repro Spec Generation

- Generate `reports/<run-id>/repro.spec.ts` from the action path that triggered an issue.
- Keep the generated spec readable and editable.

### Milestone 7: Demo Site, E2E, and Release Readiness

- Add demo site routes:
  - `/`
  - `/console-error`
  - `/page-error`
  - `/network-error`
  - `/server-error`
  - `/slow-api`
  - `/blank`
  - `/form`
- Add e2e tests.
- Add GitHub Actions.
- Add README and demo materials.
- Ensure the demo site showcases multiple bug classes, not a single login bug.
