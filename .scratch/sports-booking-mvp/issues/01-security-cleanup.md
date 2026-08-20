# 01 — Security cleanup

**What to build:** the repos no longer leak secrets or carry dead code. A new contributor cloning the backend cannot recover any live credential, and the frontend builds without hardcoded third-party config.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Firebase service-account keys removed from the repo, git history scrubbed (or repo history replaced), and new keys rotated into environment variables
- [ ] Committed log files (backend) deleted and gitignored
- [ ] Dead IBAN/bank code (`ibanValidator`, `IBAN_Specifications`, stray `Node.json`) deleted and the missing `iban` dependency no longer referenced
- [ ] Frontend hardcoded Firebase fallback config removed; a `.env.example` documenting all frontend env vars added
- [ ] Both repos still build/start cleanly with fresh env files

## Comments
Completed: 2026-08-19
