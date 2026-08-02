// Test-only stand-in for the not-yet-implemented `../auth/cognitoAuth` module
// (Task 3). client.test.ts never touches `apiClient` (the default export at
// the bottom of client.ts that wires this in) — it only calls
// `createApiClient(...)` directly with a fake token getter. This stub exists
// solely because Vite's import-analysis resolves every static import in a
// module at transform time, even ones the tests never execute. It is wired
// in via `test.alias` in vitest.config.ts, not a real path Task 3 will use,
// so it does not conflict with Task 3's implementation.
export async function getCurrentIdToken(): Promise<string | null> {
  return null;
}
