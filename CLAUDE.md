## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Workflow

- Ne jamais commiter ni pousser sur `main`
- Branches : `feat/<n°issue>-<slug>`, `fix/<n°issue>-<slug>`
- Commits : Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`)
- Avant de terminer : `npm run lint && npm run typecheck && npm test`
- Ne jamais utiliser `push --force` (seulement `--force-with-lease`, et sur sa branche)
