# Rate Shopper

Hotel rate parity & competitor rate monitoring tool. Scrapes Google Hotels for pricing data, stores historical rates in PostgreSQL, auto-refreshes 3x daily, and provides a dark-themed dashboard for parity analysis and rate trend visualization.

## Architecture

- **Backend**: Node.js / Express / TypeScript
- **Frontend**: React / Vite / TailwindCSS / Recharts
- **Database**: PostgreSQL 16
- **Scraper**: Puppeteer with stealth plugin
- **Scheduler**: node-cron (3x daily)
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Setup

```bash
# Clone and install
cp .env.example .env
make setup

# Start development
make dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

### Docker (Production)

```bash
docker-compose up -d
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/rates/current?property_id=X` | Latest rates for all competitors |
| GET | `/api/rates/history?competitor_id=X&check_in=DATE&days=30` | Rate history |
| GET | `/api/rates/grid?property_id=X` | Rate grid matrix |
| POST | `/api/refresh` | Trigger manual refresh |
| GET | `/api/refresh/:id/status` | Refresh progress |
| GET | `/api/parity?property_id=X&status=new` | Parity violations |
| PATCH | `/api/parity/:id/acknowledge` | Acknowledge alert |
| GET | `/api/competitors?property_id=X` | List competitors |
| POST | `/api/competitors` | Add competitor |
| DELETE | `/api/competitors/:id` | Remove competitor |
| GET | `/api/history/rate-changes?property_id=X&from=DATE&to=DATE` | Rate changes |
| GET | `/api/calendar?property_id=X&month=YYYY-MM` | Calendar view |
| GET | `/api/calendar/cheapest-summary?property_id=X&month=YYYY-MM` | Cheapest channel summary |
| GET | `/api/dashboard/summary?property_id=X` | Dashboard KPIs |

## Configuration

See `.env.example` for all available environment variables:

- **Database**: `DATABASE_URL`
- **Scraper**: concurrency, timeouts, delays
- **Scheduler**: 3 configurable cron schedules
- **Rate Settings**: parity threshold %, look-ahead days, base currency

## Dashboard Pages

1. **Dashboard Overview** - KPIs, rate grid with color-coded parity
2. **Rate Grid** - Competitor x date matrix
3. **Rate History** - Trend charts over time
4. **Parity Alerts** - Active parity violations
5. **Rate Changes** - Real-time rate change feed
6. **Calendar** - Monthly calendar with cheapest channel analysis
7. **Settings** - Competitor & schedule management

## Make Commands

```bash
make setup       # First-time setup
make dev         # Start dev mode
make refresh     # Trigger manual refresh
make logs        # Tail all logs
make stop        # Stop services
make clean       # Remove everything
make db-migrate  # Run DB migrations
```
