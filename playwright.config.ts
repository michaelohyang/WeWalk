import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

/** Phones first: every e2e test runs at 390×844 in light and dark. */
const phone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone-light", use: { ...phone, browserName: "chromium", colorScheme: "light" } },
    { name: "phone-dark", use: { ...phone, browserName: "chromium", colorScheme: "dark" } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster to iterate on.
    command: isCI ? `pnpm start -p ${PORT}` : `pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
