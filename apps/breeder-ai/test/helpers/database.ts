import { env } from "cloudflare:workers";

import type { AuthContext } from "../../src/auth/contracts.ts";

import { canonicalJson } from "../../src/shared/canonical-json.ts";

export const EMPTY_STATE = {
  bulkCopies: {},
  notes: {},
} as const;

export async function resetDatabase(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM identity_rebinds"),
    env.DB.prepare("DELETE FROM mutations"),
    env.DB.prepare("DELETE FROM idempotency_receipts"),
    env.DB.prepare("DELETE FROM inventory_states"),
    env.DB.prepare("DELETE FROM play_spaces"),
    env.DB.prepare("DELETE FROM auth_identities"),
    env.DB.prepare("DELETE FROM users"),
  ]);
}

export async function seedUser(input: {
  userId: string;
  authIdentityId: string;
  provider: string;
  issuer: string;
  subject: string;
  playSpaceIds?: string[];
}): Promise<AuthContext> {
  const now = "2026-09-14T12:00:00.000Z";
  const statements = [
    env.DB.prepare(
      "INSERT INTO users (user_id, status, created_at) VALUES (?1, 'active', ?2)",
    ).bind(input.userId, now),
    env.DB.prepare(
      `INSERT INTO auth_identities (
         auth_identity_id, user_id, provider, issuer, subject, active, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)`,
    ).bind(
      input.authIdentityId,
      input.userId,
      input.provider,
      input.issuer,
      input.subject,
      now,
    ),
  ];

  for (const playSpaceId of input.playSpaceIds ?? []) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO play_spaces (
           play_space_id, owner_user_id, status, created_at
         ) VALUES (?1, ?2, 'active', ?3)`,
      ).bind(playSpaceId, input.userId, now),
      env.DB.prepare(
        `INSERT INTO inventory_states (
           user_id, play_space_id, schema_version, state_revision,
           state_json, updated_at
         ) VALUES (?1, ?2, 1, 0, ?3, ?4)`,
      ).bind(
        input.userId,
        playSpaceId,
        canonicalJson(EMPTY_STATE),
        now,
      ),
    );
  }
  await env.DB.batch(statements);

  return {
    authIdentityId: input.authIdentityId,
    userId: input.userId,
    provider: input.provider,
    issuer: input.issuer,
    subject: input.subject,
  };
}

export async function tableCount(
  table: "idempotency_receipts" | "identity_rebinds" | "mutations",
): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{
    count: number;
  }>();
  return row?.count ?? -1;
}
