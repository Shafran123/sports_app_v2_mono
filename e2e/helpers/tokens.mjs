// Mint platform (owner/admin) bearer tokens exactly like the backend test
// suite does (sp_be/test/verifyEmail.test.js): HS256 JWTs signed with
// JWT_SECRET, accepted because the backend boots with NODE_ENV=test.
import { SignJWT } from "jose";

const E2E_JWT_SECRET = process.env.E2E_JWT_SECRET || "e2e-jwt-secret";
const E2E_USER_PORT = process.env.E2E_USER_PORT || "3010";

export async function platformToken({ uid, email, name }) {
  const secret = new TextEncoder().encode(E2E_JWT_SECRET);
  return new SignJWT({ uid, email, name, email_verified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);
}

// Inject a platform session into an app's localStorage (packages/auth
// persists the token under this key and sends it as the Bearer header).
export async function injectPlatformToken(page, { uid, email, name }, port = E2E_USER_PORT) {
  const token = await platformToken({ uid, email, name });
  await page.goto(`http://localhost:${port}/`);
  await page.evaluate((t) => {
    window.localStorage.setItem("spots_token", t);
  }, token);
  return token;
}