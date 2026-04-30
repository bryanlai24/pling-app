# Pling 🏆

Achievement and trophy tracking for serious hunters. Supports PSN, Xbox, Steam, and manual entries with deep sub-objective tracking.

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL
- **Migrations**: Alembic
- **Hosting**: Google Cloud Run + Cloud SQL

## Local setup

### 1. Clone and install

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local DB credentials
```

### 3. Start PostgreSQL (Docker)

```bash
docker run --name pling-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pling \
  -p 5432:5432 \
  -d postgres:16
```

### 4. Run migrations

```bash
alembic upgrade head
```

### 5. Start the server

```bash
uvicorn app.main:app --reload
```

API docs available at: http://localhost:8000/docs

## Project structure

```
pling/
├── app/
│   ├── main.py          # Entry point, middleware, routers
│   ├── config.py        # Settings from .env
│   ├── database.py      # Async SQLAlchemy engine + session
│   ├── models/          # ORM models (DB schema)
│   ├── schemas/         # Pydantic models (API I/O)
│   ├── routers/         # Route handlers
│   ├── services/        # Business logic
│   └── auth/            # JWT auth
├── alembic/             # DB migrations
├── Dockerfile
└── requirements.txt
```

## Deploying to Cloud Run

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/pling
gcloud run deploy pling \
  --image gcr.io/YOUR_PROJECT/pling \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=your-cloud-sql-url
```
