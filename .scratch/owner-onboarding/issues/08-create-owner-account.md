# 08 — Create owner account

**What to build:** the admin provisions an owner account. The backend creates a Firebase user (unique email — never reuses or mutates an existing Player account — temporary password, role `venue_owner`), attaches a Plan instance, and emails the owner credentials, the drafted agreement (PDF), and the platform bank details. A "create owner" form collects these; a bank-account setting is added to Settings for the emails to use.

**Blocked by:** 06 — Leads backend

**Status:** ready-for-agent

- [ ] Admin can create an owner account with unique email and temporary password
- [ ] Backend creates the Firebase user; no existing account is touched, even on email match
- [ ] New owner is attached a Plan instance (start + end)
- [ ] Email goes out with credentials, agreement PDF, and platform bank details
- [ ] Bank-account setting exists in Settings and is included in the email
- [ ] New owner cannot use the console until the agreement is accepted (ticket 10)