import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  verifyExternalIdentity,
  type ExternalIdentityClaims,
  type VerifiedExternalIdentity,
} from "../src/auth/contracts.ts";
import {
  AuthenticationRequiredError,
  IdentityConflictError,
  rebindIdentity,
  resolveAuthContext,
} from "../src/auth/identity-service.ts";
import {
  resetDatabase,
  seedUser,
  tableCount,
} from "./helpers/database.ts";

describe("qualified auth identity mapping", () => {
  beforeEach(resetDatabase);

  it("brands claims only after the verifier boundary returns valid identity fields", async () => {
    await expect(
      verifiedIdentity({
        provider: "   ",
        issuer: "https://team.cloudflareaccess.com",
        subject: "subject-a",
      }),
    ).rejects.toThrow(/provider must not be empty/u);
  });

  it("maps the same provider/issuer/subject to one stable user on multiple devices", async () => {
    await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team-a.cloudflareaccess.com",
      subject: "subject-1",
    });
    const deviceOne = await verifiedIdentity({
      provider: "cloudflare-access",
      issuer: "https://team-a.cloudflareaccess.com",
      subject: "subject-1",
      email: "first@example.test",
    });
    const deviceTwo = await verifiedIdentity({
      provider: "cloudflare-access",
      issuer: "https://team-a.cloudflareaccess.com",
      subject: "subject-1",
      email: "renamed@example.test",
    });

    expect((await resolveAuthContext(env.DB, deviceOne)).userId).toBe("user-a");
    expect((await resolveAuthContext(env.DB, deviceTwo)).userId).toBe("user-a");
  });

  it("qualifies identical subjects by provider and issuer", async () => {
    await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team-a.cloudflareaccess.com",
      subject: "shared-subject",
    });
    await seedUser({
      userId: "user-b",
      authIdentityId: "identity-b",
      provider: "cloudflare-access",
      issuer: "https://team-b.cloudflareaccess.com",
      subject: "shared-subject",
    });

    const context = await resolveAuthContext(
      env.DB,
      await verifiedIdentity({
        provider: "cloudflare-access",
        issuer: "https://team-b.cloudflareaccess.com",
        subject: "shared-subject",
      }),
    );
    expect(context.userId).toBe("user-b");
  });

  it("does not provision state for an unknown external identity", async () => {
    const unknown = await verifiedIdentity({
      provider: "cloudflare-access",
      issuer: "https://team-a.cloudflareaccess.com",
      subject: "unknown",
    });

    await expect(resolveAuthContext(env.DB, unknown)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    const users = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{
      count: number;
    }>();
    expect(users?.count).toBe(0);
  });

  it("rebinds only from an authorized context and retains the user_id", async () => {
    const current = await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "old-subject",
    });
    const replacement = await verifiedIdentity({
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "new-subject",
      email: "new@example.test",
    });

    await expect(resolveAuthContext(env.DB, replacement)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    const rebound = await rebindIdentity(env.DB, current, replacement, {
      traceId: "trace-rebind",
      now: "2026-09-14T12:01:00.000Z",
      newAuthIdentityId: "identity-new",
      identityRebindId: "rebind-1",
    });

    expect(rebound.userId).toBe("user-a");
    expect(rebound.authIdentityId).toBe("identity-new");
    await expect(
      resolveAuthContext(
        env.DB,
        await verifiedIdentity({
          provider: current.provider,
          issuer: current.issuer,
          subject: current.subject,
        }),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(await tableCount("identity_rebinds")).toBe(1);
  });

  it("rejects rebind attempts without a currently active authorized identity", async () => {
    const current = await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "old-subject",
    });
    await env.DB.prepare(
      "UPDATE auth_identities SET active = 0 WHERE auth_identity_id = ?1",
    )
      .bind(current.authIdentityId)
      .run();

    await expect(
      rebindIdentity(
        env.DB,
        current,
        await verifiedIdentity({
          provider: "cloudflare-access",
          issuer: "https://team.cloudflareaccess.com",
          subject: "new-subject",
        }),
        {
          traceId: "trace-rebind",
          now: "2026-09-14T12:01:00.000Z",
          newAuthIdentityId: "identity-new",
          identityRebindId: "rebind-1",
        },
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("never merges users because their verified emails are equal", async () => {
    await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-a",
    });
    await seedUser({
      userId: "user-b",
      authIdentityId: "identity-b",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-b",
    });
    const sharedEmail = "same@example.test";

    const contextA = await resolveAuthContext(
      env.DB,
      await verifiedIdentity({
        provider: "cloudflare-access",
        issuer: "https://team.cloudflareaccess.com",
        subject: "subject-a",
        email: sharedEmail,
      }),
    );
    const contextB = await resolveAuthContext(
      env.DB,
      await verifiedIdentity({
        provider: "cloudflare-access",
        issuer: "https://team.cloudflareaccess.com",
        subject: "subject-b",
        email: sharedEmail,
      }),
    );
    expect(contextA.userId).toBe("user-a");
    expect(contextB.userId).toBe("user-b");
  });

  it("rejects a replacement identity already owned by another user", async () => {
    const current = await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-a",
    });
    await seedUser({
      userId: "user-b",
      authIdentityId: "identity-b",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-b",
    });

    await expect(
      rebindIdentity(
        env.DB,
        current,
        await verifiedIdentity({
          provider: "cloudflare-access",
          issuer: "https://team.cloudflareaccess.com",
          subject: "subject-b",
        }),
        {
          traceId: "trace-rebind",
          now: "2026-09-14T12:01:00.000Z",
          newAuthIdentityId: "identity-new",
          identityRebindId: "rebind-1",
        },
      ),
    ).rejects.toBeInstanceOf(IdentityConflictError);
    expect(await tableCount("identity_rebinds")).toBe(0);
  });

  it("rejects invalid server-generated rebind options before writing", async () => {
    const current = await seedUser({
      userId: "user-a",
      authIdentityId: "identity-a",
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-a",
    });
    const replacement = await verifiedIdentity({
      provider: "cloudflare-access",
      issuer: "https://team.cloudflareaccess.com",
      subject: "subject-new",
    });

    const validOptions = {
      traceId: "trace-rebind",
      now: "2026-09-14T12:01:00.000Z",
      newAuthIdentityId: "identity-new",
      identityRebindId: "rebind-1",
    };
    for (const invalidOptions of [
      { ...validOptions, traceId: "" },
      { ...validOptions, now: "not-a-timestamp" },
      { ...validOptions, newAuthIdentityId: "   " },
      { ...validOptions, identityRebindId: "invalid id with spaces" },
    ]) {
      await expect(
        rebindIdentity(env.DB, current, replacement, invalidOptions),
      ).rejects.toThrow(/Identity rebind options are invalid/u);
    }
    expect(await tableCount("identity_rebinds")).toBe(0);
    const identities = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM auth_identities",
    ).first<{ count: number }>();
    expect(identities?.count).toBe(1);
  });
});

async function verifiedIdentity(
  claims: ExternalIdentityClaims,
): Promise<VerifiedExternalIdentity> {
  return verifyExternalIdentity(
    {
      verify(): Promise<ExternalIdentityClaims> {
        return Promise.resolve(claims);
      },
    },
    { assertion: "trusted-test-verifier" },
    new AbortController().signal,
  );
}
