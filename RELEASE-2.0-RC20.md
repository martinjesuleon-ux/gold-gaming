# GOLD GAMING V2.0 — RC20 release acceptance
Release candidate, not stable certification. Base RC19: 323 automated tests and 5 separate PostgreSQL tests passed on CI run 46075457955. RC20 adds finite-coordinate validation of laser effects (server payload x,y,tx,ty verified); full CI pending.
## Required before stable promotion
- [ ] Browser login/reconnect and persisted equipment, currencies, inventory and PET XP.
- [ ] PET guard, trader, fuel, repairs, protocols (reference specification pending), standard Kamikaze and test-account-only 100M Kamikaze.
- [ ] Solo gates including protected bosses; disconnect/reenter, life purchase, rewards and ledger.
- [ ] Hades with 4–8 authenticated players; group invitations, leadership, clan permissions.
- [ ] Uridium x2 and special gate rewards x2, independently scheduled and stopped; verify actual credited rewards.
- [ ] Actual concurrent-player load, CPU, RAM, latency and PostgreSQL query plan; current limit 40, not load-certified.
- [ ] Verify progress after service restart and no unexpected application errors.
- [ ] Verify original and classic visuals in PC browser; no browser screenshots certified by CI.
## Known limitations
- Same-tab reload recovery only for pending shop/gate requests; closing tab can discard journal.
- Some gate waves are provisional; LF-P01 gate drop rates and PET protocols need reference specifications.
- No automatic stable promotion until manual acceptance is documented.
