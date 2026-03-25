.PHONY: setup dev dev-backend dev-frontend refresh logs stop clean db-migrate

# First-time setup: build containers and run migrations
setup:
	docker-compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3
	docker-compose exec postgres psql -U rateshopper -d rateshopper -f /docker-entrypoint-initdb.d/01-schema.sql
	cd backend && npm install
	cd frontend && npm install
	@echo "Setup complete! Run 'make dev' to start development."

# Start all services in dev mode
dev:
	docker-compose up -d postgres
	@echo "Starting backend and frontend..."
	cd backend && npm run dev &
	cd frontend && npm run dev &
	@echo "Backend: http://localhost:3001"
	@echo "Frontend: http://localhost:5173"

# Start only backend in dev mode
dev-backend:
	docker-compose up -d postgres
	cd backend && npm run dev

# Start only frontend in dev mode
dev-frontend:
	cd frontend && npm run dev

# Trigger manual refresh via API
refresh:
	curl -X POST http://localhost:3001/api/refresh \
		-H "Content-Type: application/json" \
		-d '{}' | jq .

# Tail all service logs
logs:
	docker-compose logs -f

# Stop all services
stop:
	docker-compose down
	@pkill -f "tsx watch" || true
	@pkill -f "vite" || true

# Clean everything (removes volumes)
clean:
	docker-compose down -v
	rm -rf backend/node_modules backend/dist
	rm -rf frontend/node_modules frontend/dist

# Run database migration
db-migrate:
	docker-compose exec postgres psql -U rateshopper -d rateshopper -f /docker-entrypoint-initdb.d/01-schema.sql
