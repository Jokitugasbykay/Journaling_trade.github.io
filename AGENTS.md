# Security

- Use only the journaltrading Supabase project. Never use credentials or data from JOKIIN.
- Never commit passwords, OAuth secrets, service-role keys, access tokens, or database connection strings.
- Keep user journals and document scans isolated by authenticated user ID. Reject stale sync results after account changes.
- Enforce database ownership with RLS and server-controlled plans. Browser UI gates are not authorization.
- Never describe a browser-visible URL or publishable key as a secret. A gateway requires backend hosting.
- Never generate market/calendar values when a feed fails; show saved timestamps or an unavailable state.

# Tests

- Run `node js/copy.test.cjs`, `node js/security.test.cjs`, and `node js/discipline.test.cjs` after application changes.
- Run `python scripts/test_news.py` after feed/parser changes.
- Verify RLS changes with `supabase/test_security.sql` inside a rollback transaction.
- Verify account changes, logout in a second tab, and empty cloud accounts with mocks before publishing auth changes.

# Style

- Remove unused code only after checking HTML handlers, JavaScript calls, dynamic selectors, and styles.
- Keep comments that explain security, data ownership, or platform constraints; remove decorative banners.

# Delivery

- Rebase on origin/main before pushing; the news workflow also commits to main.
- Confirm GitHub Pages deployment before claiming the site is updated.
