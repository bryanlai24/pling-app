# Pling Roadmap

## Shipped
- [x] PSN trophy sync (per-user NPSSO token, REST API)
- [x] Nested objectives with group headers
- [x] Counter-type objectives
- [x] Objective media (image URL + YouTube embed)
- [x] Contributor seeding tool (bulk paste import)
- [x] Achievement pinning
- [x] Incomplete-first filter, persisted across navigation
- [x] Tick achievements directly from game page + toast confirmation
- [x] Auth role persistence across page refreshes
- [x] Live cache invalidation on edits/deletes
- [x] Account stats endpoint (games tracked, trophies, platinums, per-platform breakdown)
- [x] PS5-inspired dark UI redesign (OLED black, purple accent, flat rows, scalable rem typography)

---

## Upcoming

### Catalogue Population
Getting content into the shared catalogue so it's useful out of the box. This is probably the highest-leverage thing right now — the app experience is great, but there's nothing to browse.

**What to add first:** Use PSN/Xbox/Steam trending or top-played data to prioritize. Options:
- Pull from PSN's public trophy lists (most earned = most played)
- Cross-reference with Steam's "most played" charts
- Let users request games via the UI
- Community seeding sprints (contributors pick a game and fill objectives)

**Objective quality:** Beyond just having games, objectives need methods. The seeding tool makes this manageable — a small group of contributors can meaningfully fill a game in one sitting.

---

### Xbox & Steam Achievement Sync
Mirror the PSN sync architecture for the other two platforms.

**Xbox:** Connect via Xbox token (storage already exists), fetch earned achievements from the Xbox Live API, match against `platform_achievement_id`, write to `UserAchievement`.

**Steam:** Connect via Steam API key + Steam ID, fetch earned achievements from `ISteamUserStats/GetPlayerAchievements`, same matching + write pattern.

Both platforms already have token storage models and stub services — needs the sync logic wired up end-to-end.

---

### Mobile Responsiveness
The app works on mobile but isn't optimized for it. The flat row layout and rem-based scaling are a good foundation — needs a focused pass on:
- Nav (collapse to bottom bar or hamburger)
- Hero panels (tighter padding, smaller trophy art)
- Row density (touch target sizing)
- Filter tabs (scrollable or collapsed)

---

### Profile & Admin Page Redesign
Bring the profile and admin pages into the new design system. Currently functional but visually mismatched — still using gray-* Tailwind classes and card layouts from the old design.

---

### v3 Cleanup
- Delete old Cloud Run revisions (28 currently) — keep only the active one
- Review and prune unused migrations
