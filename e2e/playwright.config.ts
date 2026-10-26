import { defineConfig, devices } from "@playwright/test";

export const PORTS = {
  storage: 2499,
  backend: 2410,
  user: 3010,
  admin: 3011
};

export const SITE_HOST = "mysite.localhost";

export const E2E_DB_URL = "postgres://localhost:5432/sports_e2e";
export const E2E_JWT_SECRET = "e2e-jwt-secret";
export const E2E_OTP_HMAC_SECRET = "e2e-otp-secret";

const BACKEND_ENV = {
  NODE_ENV: "test",
  PORT: String(PORTS.backend),
  DATABASE_URL: E2E_DB_URL,
  JWT_SECRET: E2E_JWT_SECRET,
  OTP_HMAC_SECRET: E2E_OTP_HMAC_SECRET,
  FRONTEND_URL: `http://localhost:${PORTS.user}`,
  CONSOLE_URL: `http://localhost:${PORTS.admin}`,
  SOCKET_ALLOWED_ORIGINS: [
    `http://localhost:${PORTS.user}`,
    `http://localhost:${PORTS.admin}`,
    `http://${SITE_HOST}:${PORTS.user}`
  ].join(","),
  SUPABASE_URL: `http://localhost:${PORTS.storage}`,
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role",
  // Explicitly empty so dotenv never loads real keys from sp_be/.env — no
  // real Mailgun/SMSGo/reCAPTCHA traffic can ever leave the harness.
  MAILGUN_API_KEY: "",
  MAILGUN_DOMAIN: "",
  SMSGO_API_KEY: "",
  RECAPTCHA_SECRET_KEY: ""
};

const NEXT_ENV = (port) => ({
  NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.backend}`,
  NEXT_PUBLIC_SOCKET_URL: `http://localhost:${PORTS.backend}`,
  // Dummy Firebase project so the browser never talks to the real one.
  NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-firebase",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "e2e.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "e2e-project",
  NEXT_PUBLIC_FIREBASE_APP_ID: "e2e-app",
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "",
  // E2E seam (ADR-0048): restore platform sessions from localStorage instead
  // of Firebase. Never set outside this harness.
  NEXT_PUBLIC_E2E: "1"
});

export default defineConfig({
  testDir: "./specs",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }]
  ],
  use: {
    baseURL: `http://localhost:${PORTS.user}`,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "node scripts/storage-stub.mjs",
      port: PORTS.storage,
      cwd: __dirname,
      timeout: 30_000
    },
    {
      command: "node index.js",
      port: PORTS.backend,
      cwd: "../sp_be",
      env: BACKEND_ENV,
      timeout: 120_000
    },
    {
      command: `./node_modules/.bin/next dev -p ${PORTS.user}`,
      port: PORTS.user,
      cwd: "../apps/user",
      env: NEXT_ENV(PORTS.user),
      timeout: 180_000
    },
    {
      command: `./node_modules/.bin/next dev -p ${PORTS.admin}`,
      port: PORTS.admin,
      cwd: "../apps/admin",
      env: NEXT_ENV(PORTS.admin),
      timeout: 180_000
    }
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});