# GOLD GAMING 2.0.0-rc.1

Release candidate — not a stable certification.

## Changes
- Synchronize package version, login and commercial menu, health endpoint, and client cache versions.
- Reload authenticated inventory on entry/reconnect; remove redundant fuel purchase refresh.
- Extend npm run check to PET and Galaxy Gate modules introduced after V1.61.

## Release acceptance checklist (manual, pending)
- Sign in, reconnect, verify authenticated inventory, equipped PET, fuel and XP.
- Test guard against NPCs and permitted pilots, trader return, repairs and gear changes.
- Confirm administrator test Kamikaze retains 100,000,000 damage, 5,000 radius, zero cooldown; normal accounts retain normal rules.
- Complete a solo gate including protected boss; validate waves, rewards, ledger and special x2 event.
- Test Hades with 4–8 pilots, group invitations/leadership and clan membership changes.
- Confirm persisted balances and progress after restarting the service; inspect server logs and load under multiple simultaneous pilots.

## Known limitations
- PET protocols and LF-P01 gate drop rates need reference specification.
- Some wave compositions remain provisional as indicated in the generator.
- Unit/mock checks do not replace real PostgreSQL and browser/multiplayer tests. Feature flags remain unchanged.
