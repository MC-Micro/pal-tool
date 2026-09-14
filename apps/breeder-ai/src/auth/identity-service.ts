import type {
  AuthContext,
  VerifiedExternalIdentity,
} from "./contracts.ts";

interface IdentityRow {
  auth_identity_id: string;
  user_id: string;
  provider: string;
  issuer: string;
  subject: string;
}

interface RebindOptions {
  traceId: string;
  now: string;
  newAuthIdentityId: string;
  identityRebindId: string;
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "The external identity is not authorized.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class IdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityConflictError";
  }
}

export async function resolveAuthContext(
  db: D1Database,
  identity: VerifiedExternalIdentity,
): Promise<AuthContext> {
  const row = await db
    .prepare(
      `SELECT ai.auth_identity_id, ai.user_id, ai.provider, ai.issuer, ai.subject
       FROM auth_identities AS ai
       INNER JOIN users AS u ON u.user_id = ai.user_id
       WHERE ai.provider = ?1
         AND ai.issuer = ?2
         AND ai.subject = ?3
         AND ai.active = 1
         AND u.status = 'active'`,
    )
    .bind(identity.provider, identity.issuer, identity.subject)
    .first<IdentityRow>();

  if (row === null) {
    throw new AuthenticationRequiredError();
  }

  return toAuthContext(row);
}

export async function rebindIdentity(
  db: D1Database,
  currentContext: AuthContext,
  replacement: VerifiedExternalIdentity,
  options: RebindOptions,
): Promise<AuthContext> {
  if (options.traceId.trim().length === 0) {
    throw new Error("Identity rebind requires a trace_id.");
  }

  const current = await db
    .prepare(
      `SELECT auth_identity_id, user_id, provider, issuer, subject
       FROM auth_identities
       WHERE auth_identity_id = ?1 AND user_id = ?2 AND active = 1`,
    )
    .bind(currentContext.authIdentityId, currentContext.userId)
    .first<IdentityRow>();

  if (current === null || !sameContext(current, currentContext)) {
    throw new AuthenticationRequiredError(
      "Identity rebind must start from an active authorized context.",
    );
  }

  const existing = await findIdentity(db, replacement);
  if (existing !== null) {
    throw new IdentityConflictError(
      existing.user_id === currentContext.userId
        ? "The replacement identity is already bound to this user."
        : "The replacement identity is already bound to another user.",
    );
  }

  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO auth_identities (
             auth_identity_id, user_id, provider, issuer, subject, active, created_at
           )
           SELECT ?1, ?2, ?3, ?4, ?5, 1, ?6
           WHERE EXISTS (
             SELECT 1 FROM auth_identities
             WHERE auth_identity_id = ?7 AND user_id = ?2 AND active = 1
           )
             AND NOT EXISTS (
               SELECT 1 FROM auth_identities
               WHERE provider = ?3 AND issuer = ?4 AND subject = ?5
             )
           RETURNING auth_identity_id`,
        )
        .bind(
          options.newAuthIdentityId,
          currentContext.userId,
          replacement.provider,
          replacement.issuer,
          replacement.subject,
          options.now,
          currentContext.authIdentityId,
        ),
      db
        .prepare(
          `UPDATE auth_identities
           SET active = 0
           WHERE auth_identity_id = ?1
             AND user_id = ?2
             AND EXISTS (
               SELECT 1 FROM auth_identities
               WHERE auth_identity_id = ?3 AND user_id = ?2 AND active = 1
             )`,
        )
        .bind(
          currentContext.authIdentityId,
          currentContext.userId,
          options.newAuthIdentityId,
        ),
      db
        .prepare(
          `INSERT INTO identity_rebinds (
             identity_rebind_id, user_id, old_auth_identity_id,
             new_auth_identity_id, trace_id, created_at
           )
           SELECT ?1, ?2, ?3, ?4, ?5, ?6
           WHERE EXISTS (
             SELECT 1 FROM auth_identities
             WHERE auth_identity_id = ?4 AND user_id = ?2 AND active = 1
           )`,
        )
        .bind(
          options.identityRebindId,
          currentContext.userId,
          currentContext.authIdentityId,
          options.newAuthIdentityId,
          options.traceId,
          options.now,
        ),
    ]);

    if ((results[0]?.meta.changes ?? 0) !== 1) {
      const racedIdentity = await findIdentity(db, replacement);
      if (racedIdentity !== null) {
        throw new IdentityConflictError(
          "The replacement identity became bound concurrently.",
        );
      }
      throw new AuthenticationRequiredError(
        "The authorized identity became inactive during rebind.",
      );
    }
  } catch (error) {
    if (
      error instanceof IdentityConflictError ||
      error instanceof AuthenticationRequiredError
    ) {
      throw error;
    }

    const racedIdentity = await findIdentity(db, replacement);
    if (racedIdentity !== null) {
      throw new IdentityConflictError(
        "The replacement identity became bound concurrently.",
      );
    }
    throw error;
  }

  return resolveAuthContext(db, replacement);
}

async function findIdentity(
  db: D1Database,
  identity: VerifiedExternalIdentity,
): Promise<IdentityRow | null> {
  return db
    .prepare(
      `SELECT auth_identity_id, user_id, provider, issuer, subject
       FROM auth_identities
       WHERE provider = ?1 AND issuer = ?2 AND subject = ?3`,
    )
    .bind(identity.provider, identity.issuer, identity.subject)
    .first<IdentityRow>();
}

function toAuthContext(row: IdentityRow): AuthContext {
  return {
    authIdentityId: row.auth_identity_id,
    userId: row.user_id,
    provider: row.provider,
    issuer: row.issuer,
    subject: row.subject,
  };
}

function sameContext(row: IdentityRow, context: AuthContext): boolean {
  return (
    row.auth_identity_id === context.authIdentityId &&
    row.user_id === context.userId &&
    row.provider === context.provider &&
    row.issuer === context.issuer &&
    row.subject === context.subject
  );
}
