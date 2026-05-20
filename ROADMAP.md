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
- [x] Xbox achievement sync (per-user OAuth, popup flow, per-game sync)
- [x] Game request system (vote ranking, contributor seed queue, social graph foundation)
- [x] Mobile responsiveness pass (bottom nav, touch targets, responsive hero panels)
- [x] Profile & Admin page redesign (full design system alignment)
- [x] Design system polish pass (0.5px hairlines, CSS vars throughout, modal consistency)
- [x] Backend deployed to Cloud Run (Alembic migrations, Cloud SQL, auto-migrate on startup)
- [x] Objective text formatting — inline markdown renderer (bold, italic, lists, paragraphs)
- [x] Collapsible objective groups
- [x] Platform-neutral game schema (TrophySet.platform, AchievementPlatformId, multi-platform sync)
- [x] Game seeding — import 12 iconic titles from Steam public API, no ownership required
- [x] Cloud Run cleanup (old revisions purged, min-instances 0)

---

## v3

### Guest Mode + Landing Page 🔥
The highest-leverage thing for growth — new users should experience the product before they're asked to sign up.

**Entry point — Landing page**
Inspired by Letterboxd: the product *is* the landing page. A hero that shows Pling in action — featured game card, achievement rows with objectives visible, a completion ring. Tagline: "Track every achievement. Master every game." Below the fold: featured games from the seeded catalogue so there's real content to browse immediately.

**Guest permissions**
Guests can do everything that's purely consumption-based without an account:
- Browse the full catalogue
- Read objectives and guides
- Manually check off achievements on any game (stored in localStorage)

The account wall goes up only at meaningful persistence moments:
- Adding a game to their library (saved across devices / sessions)
- Syncing PSN / Xbox / Steam
- Tracking progress across more than one game (localStorage gets unwieldy — natural nudge point)

**The CTA**
No banners, no nudges. One clean modal, triggered contextually when they hit a hard gate. Copy tied to what they just tried to do — e.g. "Create a free account to save your progress across devices and sync your platforms."

---

### Shareable Profile / Social
Public profile URL (`pling.app/u/username`) showing completion stats, pinned achievements, recently played. Foundation for social graph — follow friends, see their activity.

---

### QOL — Objective Interactions
- Drag-to-reorder objectives within a group
- Auto-tick group when all children are completed
- Auto-collapse completed groups
- Search/filter within an achievement's objective list

---

### Notifications
In-app or push notifications for: game added to catalogue (matching a request), friend completes a game, new objective added to a tracked game.

---

### Tab Title / Page Titles
Currently shows "pling-client" in the browser tab. Should be "Pling" by default, with dynamic per-page titles — e.g. "Elden Ring · Pling", "Your Library · Pling", "Dark Souls III — Persistence of Flame · Pling".

---

### Privacy Policy
Draft covering: data collected (account info, platform tokens, achievement progress), how it's used, third-party services (PSN/Xbox/Steam APIs, Google Cloud Run, Cloud SQL), user rights (deletion, export), cookie usage. Draft ready for legal review before publishing.
