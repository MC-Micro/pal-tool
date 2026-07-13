const encoder = new TextEncoder();
const MAX_TOKEN_SEGMENT_LENGTH = 512;
const MISSING_SECRET_SENTINEL = "palworld-breeding-api-missing-secret";

export interface AuthorizedPath {
  endpoint: string;
  trailingSegments: string[];
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = encoder.encode(value.slice(0, MAX_TOKEN_SEGMENT_LENGTH));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function constantTimeTokenMatch(supplied: string, expected: string | undefined): Promise<boolean> {
  const expectedValue = expected ?? MISSING_SECRET_SENTINEL;
  const [suppliedDigest, expectedDigest] = await Promise.all([
    digest(supplied),
    digest(expectedValue),
  ]);

  let difference = suppliedDigest.length ^ expectedDigest.length;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= (suppliedDigest[index] ?? 0) ^ (expectedDigest[index] ?? 0);
  }

  if (expected === undefined || expected.length === 0 || supplied.length === 0) difference |= 1;
  if (supplied.length > MAX_TOKEN_SEGMENT_LENGTH) difference |= 1;
  if (expected !== undefined && expected.length > MAX_TOKEN_SEGMENT_LENGTH) difference |= 1;
  return difference === 0;
}

export async function authorizePath(
  pathname: string,
  expectedToken: string | undefined,
): Promise<AuthorizedPath | null> {
  const segments = pathname.split("/");
  const suppliedToken = segments[1] ?? "";

  if (!(await constantTimeTokenMatch(suppliedToken, expectedToken))) return null;
  if (segments[0] !== "" || segments[2] !== "v1") return null;

  return {
    endpoint: segments[3] ?? "",
    trailingSegments: segments.slice(4).filter((segment) => segment.length > 0),
  };
}
