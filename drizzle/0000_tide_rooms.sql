CREATE TABLE rooms (
  code TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  payload TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX rooms_expires ON rooms (expires);
