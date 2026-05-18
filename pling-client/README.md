# pling-client

React frontend for Pling. Hosted on Firebase Hosting.

## Stack

- **React 18** + **Vite**
- **TanStack Query** — server state, caching, and cache invalidation
- **Zustand** — lightweight client state (auth)
- **React Router v6** — routing
- **Tailwind CSS** — styling
- **Lucide React** — icons

## Local Setup

```bash
npm install
npm run dev
```

The dev server proxies API requests to `http://localhost:8000` by default. Set `VITE_API_URL` in `.env.local` to point at the production server if needed.

## Project Structure

```
src/
├── App.jsx                  # Root — auth bootstrap, routes
├── api/
│   ├── client.js            # Axios instance with auth header injection
│   ├── achievements.js
│   ├── objectives.js
│   ├── games.js
│   ├── auth.js
│   └── genres.js
├── store/
│   ├── authStore.js         # Zustand: token, user object, isGuest, setUser, logout
│   └── uiStore.js
├── hooks/
│   └── useContributorCheck.js  # requireContributor() gating + ContributorPrompt trigger
├── pages/
│   ├── LibraryPage.jsx      # User's game library
│   ├── GamePage.jsx         # Achievement list for a game (filter, pin, sort)
│   ├── AchievementPage.jsx  # Achievement detail + objectives
│   ├── AdminPage.jsx        # Admin tools (PSN trophy lookup, etc.)
│   ├── ProfilePage.jsx      # PSN/Xbox connect, account info
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
└── components/
    ├── objectives/
    │   ├── ObjectiveItem.jsx       # Single objective row (tick/counter, expand, edit, media)
    │   ├── AddObjectiveModal.jsx   # Create objective (supports group assignment)
    │   └── SeedObjectivesModal.jsx # Bulk seed from structured text
    ├── achievements/
    │   └── AddAchievementModal.jsx
    ├── games/
    │   └── AddGameModal.jsx
    ├── layout/
    │   └── Layout.jsx
    └── ui/
        ├── ContributorPrompt.jsx   # Modal: join Discord to become a contributor
        └── GuestTrackingPrompt.jsx # Modal: sign up to track progress
```

## Auth

Auth state lives in Zustand (`authStore`). The JWT token is persisted to `localStorage`; the full user object (including role) is **not** — it's re-fetched from `GET /users/me` on every app load so the role is always fresh.

```js
// App.jsx — bootstrap on load
useEffect(() => {
  if (token) {
    getMe().then(r => setUser(r.data)).catch(() => {})
  }
}, [token])
```

## Key Patterns

### Cache Invalidation
After any mutation (tick, edit, delete, counter update), call:
```js
queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })
```
This triggers a refetch and updates the UI immediately without a page reload.

### Contributor Gating
Wrap any contributor-only action with `requireContributor()` from `useContributorCheck`:
```js
const { requireContributor } = useContributorCheck()

<button onClick={() => requireContributor(() => doTheAction())}>Edit</button>
```
If the user isn't a contributor, a prompt appears directing them to Discord.

### Guest Gating
Check `isGuest` from `useAuthStore` before tracking actions:
```js
const { isGuest } = useAuthStore()
if (isGuest) { setShowGuestPrompt(true); return }
```

## Objectives

### ObjectiveItem
Renders a single objective with:
- Checkbox (boolean) or counter controls (increment/decrement/input)
- Expandable method text, image, and YouTube embed
- Inline edit form (title, method, image URL, YouTube URL)

### SeedObjectivesModal
Accepts pasted text in this format:
```
Group Name
    Step title | Method text
    Another step
Standalone objective | Method
```
Posts objectives sequentially with live progress logging. Indented lines become children of the preceding group.

### AddObjectiveModal
Supports assigning a new objective to an existing group via a dropdown (populated from `achievement.objectives` where `children.length > 0`).

## Deployment

```bash
npm run build
firebase deploy --only hosting
```

Firebase project: `pling-app-alpha`
Live URL: `https://pling-app-alpha.web.app`

## Achievement Filtering (GamePage)

Default view is **Incomplete** first. Tab order: Incomplete → Complete → Game Order.

Pinned achievements are shown in a dedicated section at the top regardless of the active filter. Pinning is per-user and stored in `UserAchievement.is_pinned`.
