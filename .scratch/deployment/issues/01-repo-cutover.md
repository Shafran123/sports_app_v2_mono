# 01 — Cut over monorepo to sports_app_v2_mono (single source of truth)

Type: task
Status: completed

## Context

The new repo `Shafran123/sports_app_v2_mono` is empty. `sp_be` is currently gitignored with its own nested `.git`; `sp_fe` is dead and still present in the working tree; `.gitignore`'s blanket `*.json` rule would swallow `sp_be/package.json` and `sp_be/package-lock.json`, which Railway's nixpacks build needs.

## Deliverables

- Delete `sp_fe/` from the working tree.
- Remove `sp_be/.git` (nested repo) so `sp_be` joins the monorepo.
- `.gitignore`:
  - Remove the `/sp_be/` and `/sp_fe/` lines.
  - Add `!/sp_be/package.json` and `!/sp_be/package-lock.json` (they are caught by the blanket `*.json`).
  - Keep `*.json`, `sports-app-20029-firebase*.json`, `.env` / `.env*.local` ignored; add `/sp_be/uploads/`.
- `git add -A`; verify `git status` shows `sp_be/` source staged, and **no** `uploads/` files, **no** firebase JSON, **no** `.env`.
- `git remote add origin https://github.com/Shafran123/sports_app_v2_mono.git && git push -u origin main` (remote is empty — if GitHub created a README on init, pull with `--allow-unrelated-histories` first).
- Monorepo commit style: conventional commits on `main`.

## Done

- [ ] `sp_fe/` gone; `sp_be/` tracked with no nested `.git`.
- [ ] `sp_be/package.json` + `package-lock.json` committed; firebase JSON, `.env*`, `uploads/` NOT committed.
- [ ] Push to `sports_app_v2_mono` succeeds; remote `origin` configured.

Blocked by: none

## Completed

Implemented. Evidence: commit `f862142` pushed to `origin/main` (`Shafran123/sports_app_v2_mono`, 617 tree entries, verified via `gh api`). `sp_fe/` deleted; `sp_be/.git` removed; `.gitignore` tracks `sp_be/` (manifests un-ignored via `!/sp_be/package.json` + `!/sp_be/package-lock.json`, `/sp_be/uploads/` excluded); no `.env`/firebase JSON/`uploads/` staged.

Note: first push was rejected by GitHub secret-scanning push protection — a real Mailgun API key was committed in `.scratch/mailgun-wiring/{spec.md,issues/01-...}.md`; scrubbed to `<your-mailgun-api-key>` and amended (never reached the remote, no rotation needed). Full backups of both legacy dirs at `/var/folders/.../T/opencode/spots-backup/{sp_fe,sp_be}.tgz`.