const verifiedIdentityBrand: unique symbol = Symbol("verified-identity");

export interface ExternalIdentityClaims {
  provider: string;
  issuer: string;
  subject: string;
  email?: string;
}

export interface VerifiedExternalIdentity extends ExternalIdentityClaims {
  readonly [verifiedIdentityBrand]: true;
}

export interface AuthEvidence {
  assertion: string;
}

export interface AuthVerifier {
  verify(evidence: AuthEvidence, signal: AbortSignal): Promise<ExternalIdentityClaims>;
}

export interface AuthContext {
  authIdentityId: string;
  userId: string;
  provider: string;
  issuer: string;
  subject: string;
}

export interface AdminRecoveryRequest {
  recoveryCaseId: string;
  targetUserId: string;
  verifiedReplacementIdentity: VerifiedExternalIdentity;
  approvedByAdminId: string;
  traceId: string;
}

export interface AdminRecoveryPort {
  recoverIdentity(request: AdminRecoveryRequest): Promise<AuthContext>;
}

/**
 * The verifier is the runtime trust boundary. The brand prevents accidental
 * mixing in typed code; it is not a runtime security primitive.
 */
export async function verifyExternalIdentity(
  verifier: AuthVerifier,
  evidence: AuthEvidence,
  signal: AbortSignal,
): Promise<VerifiedExternalIdentity> {
  const claims = await verifier.verify(evidence, signal);
  const provider = requireQualifiedClaim(claims.provider, "provider");
  const issuer = requireQualifiedClaim(claims.issuer, "issuer");
  const subject = requireQualifiedClaim(claims.subject, "subject");

  return {
    provider,
    issuer,
    subject,
    ...(claims.email === undefined ? {} : { email: claims.email }),
    [verifiedIdentityBrand]: true,
  };
}

function requireQualifiedClaim(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Verified identity ${name} must not be empty.`);
  }
  return normalized;
}
