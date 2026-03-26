-- Rate Shopper Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    google_hotels_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Competitors table
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    google_hotels_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate snapshots table
CREATE TABLE IF NOT EXISTS rate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'google_hotels',
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_type VARCHAR(255),
    rate_amount NUMERIC(10, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',
    is_available BOOLEAN NOT NULL DEFAULT true,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refresh_id UUID
);

-- Refresh logs table
CREATE TABLE IF NOT EXISTS refresh_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_competitors INT NOT NULL DEFAULT 0,
    successful_scrapes INT NOT NULL DEFAULT 0,
    failed_scrapes INT NOT NULL DEFAULT 0,
    error_log TEXT
);

-- Parity alerts table
CREATE TABLE IF NOT EXISTS parity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    rate_snapshot_id UUID REFERENCES rate_snapshots(id) ON DELETE SET NULL,
    our_rate NUMERIC(10, 2) NOT NULL,
    competitor_rate NUMERIC(10, 2) NOT NULL,
    difference_amount NUMERIC(10, 2) NOT NULL,
    difference_pct NUMERIC(5, 2) NOT NULL,
    check_in_date DATE NOT NULL,
    room_type VARCHAR(255),
    alert_status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (alert_status IN ('new', 'acknowledged')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate change log table
CREATE TABLE IF NOT EXISTS rate_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    room_type VARCHAR(255),
    old_rate NUMERIC(10, 2) NOT NULL,
    new_rate NUMERIC(10, 2) NOT NULL,
    change_amount NUMERIC(10, 2) NOT NULL,
    change_pct NUMERIC(5, 2) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_snapshots_property_checkin
    ON rate_snapshots (property_id, check_in_date);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_competitor_scraped
    ON rate_snapshots (competitor_id, scraped_at);

CREATE INDEX IF NOT EXISTS idx_parity_alerts_property_status
    ON parity_alerts (property_id, alert_status);

CREATE INDEX IF NOT EXISTS idx_competitors_property
    ON competitors (property_id);

CREATE INDEX IF NOT EXISTS idx_refresh_logs_property
    ON refresh_logs (property_id);

CREATE INDEX IF NOT EXISTS idx_rate_change_log_property_detected
    ON rate_change_log (property_id, detected_at);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_refresh_id
    ON rate_snapshots (refresh_id);
