PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE auth_identities (
  auth_identity_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  provider TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (provider, issuer, subject)
) STRICT;

CREATE INDEX auth_identities_user_idx
  ON auth_identities(user_id, active);

CREATE TABLE identity_rebinds (
  identity_rebind_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  old_auth_identity_id TEXT NOT NULL REFERENCES auth_identities(auth_identity_id),
  new_auth_identity_id TEXT NOT NULL REFERENCES auth_identities(auth_identity_id),
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (new_auth_identity_id)
) STRICT;

CREATE TABLE play_spaces (
  play_space_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  UNIQUE (owner_user_id, play_space_id)
) STRICT;

CREATE TABLE inventory_states (
  user_id TEXT NOT NULL,
  play_space_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  state_revision INTEGER NOT NULL CHECK (state_revision >= 0),
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, play_space_id),
  FOREIGN KEY (user_id, play_space_id)
    REFERENCES play_spaces(owner_user_id, play_space_id)
) STRICT;

CREATE TABLE idempotency_receipts (
  user_id TEXT NOT NULL,
  play_space_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  normalized_payload TEXT NOT NULL CHECK (json_valid(normalized_payload)),
  before_revision INTEGER NOT NULL CHECK (before_revision >= 0),
  after_revision INTEGER NOT NULL CHECK (after_revision = before_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, play_space_id, idempotency_key),
  FOREIGN KEY (user_id, play_space_id)
    REFERENCES play_spaces(owner_user_id, play_space_id)
) STRICT;

CREATE TABLE mutations (
  mutation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  play_space_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_revision INTEGER NOT NULL CHECK (before_revision >= 0),
  after_revision INTEGER NOT NULL CHECK (after_revision = before_revision + 1),
  normalized_payload TEXT NOT NULL CHECK (json_valid(normalized_payload)),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, play_space_id, idempotency_key),
  FOREIGN KEY (user_id, play_space_id)
    REFERENCES play_spaces(owner_user_id, play_space_id)
) STRICT;
