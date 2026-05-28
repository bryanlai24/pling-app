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
- [x] Tab titles — dynamic per-page titles via usePageTitle hook ("Page · Pling"), base title fixed
- [x] Steam display name on profile (GetPlayerSummaries lookup, shown in place of steamID64)
- [x] Guest Mode + Landing Page — browse full catalogue, track one game via localStorage, contextual CTA modal on second game; landing page with rotating featured game hero (real-time activity), catalogue grid, no-auth public routes for /games/:id and /achievements/:id
- [x] Xbox cover art on import, gamerscore (xG / yG) display on game page
- [x] Xbox unique constraint fix — scoped AchievementPlatformId uniqueness to per-game (achievement_id, platform)
- [x] Shareable public profiles (`/u/:username`) — Legacy score, Trophy Room (completed games with platform symbols), recently played, platform badges
- [x] Xbox sync fix — gate earned achievements on `progress_state == "Achieved"` (not `time_unlocked` which Xbox populates for all achievements with .NET zero date)
- [x] Xbox import deduplication fix — strict title matching prevents cross-franchise title_id collisions (e.g. Gears 2 vs Gears 4)
- [x] Per-game progress reset — clears UserAchievement rows + zeroes UserGame, user re-syncs to repopulate
- [x] Privacy Policy draft — 11-section Word doc ready for legal review
- [x] Public profile polish — hide raw steamID64, clean PSN trophies label

---

## v3 ✅ Shipped

### Social Sign-In
Google OAuth, Discord OAuth, and Apple ID (credentials-ready). Zero-friction onboarding alongside guest mode. Username picker for new accounts, email-based account merge for existing accounts, full popup flow for Discord.

### QOL — Objective Interactions
Drag-to-reorder objectives, auto-collapse completed groups, search/filter within achievement objective lists.

---

## v4

### Notifications
In-app or push notifications for: game added to catalogue (matching a request), friend completes a game, new objective added to a tracked game.

### Physical-Era Xbox Games
Games with disc-only launches (Halo 3, Gears 1, etc.) don't appear in the Xbox played titles API. Add a manual title ID entry path in the Admin import form so contributors can import them by numeric title_id directly.

### Platinum Trophy SVG Refresh
Push the custom platinum trophy closer to the real silhouette — wider shallow bowl, short stem, flat base, cool metallic lavender sheen with horizontal body ridges. Stay clear of Sony's exact assets while landing unmistakably "PlayStation platinum".
