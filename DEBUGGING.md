# Pling — Debugging Cheatsheet

## Local Development

### Starting the stack
```bash
cd /Users/bryan/Documents/pling-app
docker compose up          # start everything
docker compose up --build  # rebuild images first
docker compose down        # stop everything
docker compose down -v     # stop + wipe database volumes (fresh start)
```

### Accessing the database locally
```bash
docker exec -it pling-db psql -U postgres -d pling-db
```

Useful queries:
```sql
\dt                                          -- list all tables
SELECT id, username, role FROM users;        -- check users
SELECT title, platform FROM games;           -- check games
SELECT trophy_type, COUNT(*) FROM achievements GROUP BY trophy_type;
SELECT completion_percent FROM user_games;   -- check progress
UPDATE users SET role = 'admin' WHERE username = 'yourusername';
```

### Virtual environment
```bash
cd /Users/bryan/Documents/pling-app/pling-server
source venv/bin/activate
```

If venv has broken paths (after directory rename):
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Alembic migrations
```bash
# Apply all pending migrations
python3 -m alembic upgrade head

# Generate new migration from model changes
python3 -m alembic revision --autogenerate -m "description"

# Check current migration state
python3 -m alembic current
python3 -m alembic history

# Always use python3 -m alembic (not just alembic) to ensure correct venv
```

### Common migration pitfalls
- **Enum types** — autogenerate does NOT create PostgreSQL enum types. Add manually:
  ```python
  def upgrade():
      op.execute("CREATE TYPE user_role_enum AS ENUM ('user', 'contributor', 'admin')")
      op.add_column('users', sa.Column('role', sa.Enum(..., name='user_role_enum')))

  def downgrade():
      op.drop_column('users', 'role')
      op.execute("DROP TYPE user_role_enum")
  ```
- **Empty migrations** — if a table already exists locally, autogenerate produces empty migrations. Add the CREATE TABLE manually.
- **Duplicate migrations** — delete empty ones and fix `down_revision` pointers.
- **server_default missing** — `DateTime(timezone=True)` columns need `server_default=sa.text('now()')` or Cloud Run inserts will fail with not-null violations.

---

## PSN Integration

### The throwaway account
- A dedicated PSN account is used for API authentication (not your main)
- The main account's `account_id` is stored on your user profile for game/trophy lookups
- NPSSO tokens expire — stored in `.env` as `PSN_NPSSO_TOKEN`

### Getting a fresh NPSSO token
1. Log into PlayStation.com in browser with the **throwaway** account
2. Visit `https://ca.account.sony.com/api/v1/ssocookie`
3. Copy the 64-character token
4. Update `.env` locally or Secret Manager for production

### Token persistence (production)
OAuth tokens are stored in the `psn_tokens` table. The app auto-refreshes using the refresh token (~2 months lifetime). Only update NPSSO when the refresh token expires.

Check token health:
```
GET /api/admin/psn/status
```

### Finding a game's NP Communication ID
```python
from psnawp_api import PSNAWP

psnawp = PSNAWP("your_throwaway_npsso")
user = psnawp.user(account_id="main_account_id")

for title in user.trophy_titles():
    if "game name" in title.title_name.lower():
        print(f"{title.title_name} | {title.np_communication_id} | {title.title_platform}")
```

### PSN privacy settings
Your main account must have trophies set to **Anyone** in PSN privacy settings for the throwaway to read your trophy data.

### psnawp version
Always use `psnawp==3.0.3`. Later versions may have breaking changes.

### bcrypt version
Always use `bcrypt==4.0.1`. Newer versions raise errors for passwords over 72 bytes.

---

## Common Errors

### `UserAchievement` import error
```
ImportError: cannot import name 'UserAchievement' from 'app.models.progress'
```
`UserAchievement` and `UserObjective` live in `app/models/achievement.py`, not `progress.py`. Check all service files:
```bash
grep -r "from app.models.progress import" /Users/bryan/Documents/pling-app/pling-server/app
```

### Table already defined
```
sqlalchemy.exc.InvalidRequestError: Table 'X' is already defined
```
A model class is defined in two files. Find duplicates and remove one.

### MissingGreenlet error
```
MissingGreenlet: greenlet_spawn has not been called
```
A SQLAlchemy relationship is being lazily loaded outside an async context. Fix by eager loading:
```python
result = await db.execute(
    select(UserObjective)
    .where(UserObjective.id == uo.id)
    .options(selectinload(UserObjective.objective))
)
```

### Password too long
```
ValueError: password cannot be longer than 72 bytes
```
Pin `bcrypt==4.0.1` in requirements.txt.

### Alembic not finding modules
```
ModuleNotFoundError: No module named 'app'
```
Run as `python3 -m alembic` not just `alembic`. Also check `alembic/env.py` has `sys.path.insert(0, ...)`.

### Docker port conflict
```
Error: address already in use :5432
```
Homebrew Postgres is running on the same port:
```bash
brew services stop postgresql@14
```

### Docker platform mismatch (Apple Silicon)
```
Container manifest type must support amd64/linux
```
Build with explicit platform:
```bash
docker build --platform linux/amd64 -t your-image .
```

### Cloud Run migration fails (enum doesn't exist)
The initial migration is missing enum type creation. Add `op.execute("CREATE TYPE ...")` before `op.add_column`.

### Cloud SQL proxy error
```
could not find default credentials
```
Run:
```bash
gcloud auth application-default login
```

---

## Production (GCP)

### Useful commands
```bash
# View live logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pling-server" \
  --limit=50 --project=pling-app-alpha --format="value(textPayload)"

# Connect to production database
gcloud sql connect pling-db --user=pling-user --project=pling-app-alpha
# (run gcloud auth application-default login first if proxy fails)

# Update a secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=- --project=pling-app-alpha

# Deploy backend
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/pling-app-alpha/pling/pling-server:latest ./pling-server
docker push us-central1-docker.pkg.dev/pling-app-alpha/pling/pling-server:latest
gcloud run deploy pling-server \
  --image=us-central1-docker.pkg.dev/pling-app-alpha/pling/pling-server:latest \
  --platform=managed --region=us-central1 \
  --add-cloudsql-instances=pling-app-alpha:us-central1:pling-db \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,PSN_NPSSO_TOKEN=PSN_NPSSO_TOKEN:latest" \
  --set-env-vars="APP_ENV=production,ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=1440" \
  --allow-unauthenticated --min-instances=0 --max-instances=2 \
  --project=pling-app-alpha

# Deploy frontend
cd pling-client && npm run build && firebase deploy --only hosting
```

### Promoting a user to admin (production)
```bash
gcloud sql connect pling-db --user=pling-user --project=pling-app-alpha
```
```sql
\c pling-db
UPDATE users SET role = 'admin' WHERE username = 'yourusername';
```

### Production database is empty after registration
You may be connected to the wrong database. Check:
```sql
SELECT current_database();  -- should be pling-db
\c pling-db                  -- switch if needed
```

---

## Node / nvm

### nvm not found after terminal restart
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use --lts
```

Add to `~/.zshrc` to make permanent.

### Firebase CLI requires Node 20+
```bash
nvm install --lts
nvm use --lts
npm install -g firebase-tools
```
