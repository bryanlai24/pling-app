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
- [x] Steam achievement sync (vanity URL resolver, per-game sync, privacy setting guidance)
- [x] Xbox achievement sync (per-user OAuth, copy-paste auth code flow, per-game sync)
- [x] Game request system (vote ranking, contributor seed queue, social graph foundation)
- [x] Mobile responsiveness pass (bottom nav, touch targets, responsive hero panels)
- [x] Profile & Admin page redesign (full design system alignment)
- [x] Design system polish pass (0.5px hairlines, CSS vars throughout, modal consistency)
- [x] Backend deployed to Cloud Run (Alembic migrations, Cloud SQL)

---

## Upcoming

### Catalogue Population
The highest-leverage thing right now — the app experience is solid, but there's nothing to browse as a new user.

**Strategy:** Community seeding sprints. Contributors pick a game and fill objectives using the seeding tool (one sitting per game). Prioritise by request votes.

**What makes a good catalogue game:**
- Has a well-known trophy/achievement list (popular or notorious)
- Has enough community documentation to write good objective methods
- Requested by multiple users

---

### Objective Text Formatting (QOL)
Rich text in objective method fields — newlines, bold, italics. Lightweight markdown renderer (no editor needed — contributors paste content). Meaningful for readability on longer guides.

---

### Shareable Profile / Social
Public profile URL (`pling.app/u/username`) showing completion stats, pinned achievements, recently played. Foundation for social graph — follow friends, see their activity.

---

### Notifications
In-app or push notifications for: game added to catalogue (matching a request), friend completes a game, new objective added to a tracked game.

---

### Cloud Run housekeeping
- Delete old revisions (keep only active + 1 prior)
- Set min-instances to 0 on non-prod (cost)
