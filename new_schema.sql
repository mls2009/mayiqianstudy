-- users table with score fields
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	total_score INTEGER DEFAULT 0,
	today_score INTEGER DEFAULT 0,
	last_reset_date TEXT
);

-- behavior records table (simplified)
CREATE TABLE IF NOT EXISTS records (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	behavior_name TEXT NOT NULL,
	score INTEGER NOT NULL,
	timestamp TEXT NOT NULL,
	date TEXT NOT NULL,
	category TEXT,
	item_index INTEGER,
	FOREIGN KEY(user_id) REFERENCES users(id)
);

-- indices for typical queries
CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_records_timestamp ON records(timestamp);
