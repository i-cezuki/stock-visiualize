# Seasoning Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `frontend/` React app for Seasoning Stock — Cognito login (no signup, admin-created users only), the seasoning list with 5-level amount bars, add/edit/delete, the shopping list, offline read-only caching, and PWA app-shell installability — matching `調味料管理アプリ設計書.md` §8/§9/§10/§11 and the already-deployed `backend/` API + Terraform Cognito/API Gateway.

**Architecture:** Vite + React 18 + TypeScript SPA. `src/auth/` wraps `amazon-cognito-identity-js` (chosen over full Amplify for a smaller, more directly-testable surface) behind a small `AuthContext`. `src/api/` is a thin fetch wrapper that injects the Cognito ID token and maps non-2xx responses to a typed `ApiError` — mirroring `backend/src/errors/apiError.ts`'s shape (`{ error: { code, message } }`) since that's what `backend/src/handler.ts` emits. `src/hooks/` wraps `@tanstack/react-query` around `src/api/seasonings.ts`; the `QueryClient` is persisted to `localStorage` via `@tanstack/react-query-persist-client`, which is what makes "view your stock while offline" work — the persisted cache is a plain read of whatever `GET /seasonings` last returned, so no separate offline data layer is needed. Design direction: refined, warm, native-feeling — the design doc explicitly asks for "Apple純正アプリのようなミニマルな雰囲気" (an Apple-native minimal feel), so this plan uses the actual system font stack (`-apple-system, BlinkMacSystemFont, ...`) rather than an imported web font — on Apple devices this **is** San Francisco, which is the most faithful way to hit that brief. Category colors and icons come directly from `backend/src/services/categoryDefaults.ts`'s 5 entries (液体/チューブ/瓶/粉/スパイス), so frontend and backend agree on what each category looks like without needing to share code.

**Verification model:** `npm run build` (Vite + `tsc`) must succeed, `npm test` (Vitest + React Testing Library) must pass for every task with tests, and Task 10 does a real browser smoke test of the running dev server via Playwright (per this project's own convention: UI changes get driven in an actual browser, not just unit tests, before being called done). Not every component gets a red/green TDD cycle — pure layout/presentational pieces (page shells, empty/loading states) are implemented directly and reviewed, matching how frontend teams typically allocate test effort; logic-bearing code (auth, API client, hooks, the amount-bar/shopping-list interaction logic) does get tests written first.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, `@tanstack/react-query` (+ persist-client + sync-storage-persister for offline caching), `react-router-dom`, `amazon-cognito-identity-js`, `vite-plugin-pwa`, Vitest + `@testing-library/react` for tests.

**Environment variables (Task 0 sets up `.env.example`; the user fills in `.env` from `terraform output` after `apply`):**
- `VITE_API_BASE_URL` — from Terraform's `api_invoke_url` output
- `VITE_COGNITO_USER_POOL_ID` — from `cognito_user_pool_id`
- `VITE_COGNITO_CLIENT_ID` — from `cognito_user_pool_client_id`

**Out of scope for this plan:** Deploying the built frontend to the S3 bucket / invalidating CloudFront (a manual `aws s3 sync` + `aws cloudfront create-invalidation` step, or a future CI task — this plan only builds the app), household sharing, notifications, recipe integration, barcode/OCR/AI (all explicitly deferred in the design doc §15).

---

## File Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .gitignore
├── public/
│   └── icon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── router.tsx
    ├── types/
    │   └── seasoning.ts
    ├── auth/
    │   ├── cognitoAuth.ts
    │   ├── cognitoAuth.test.ts
    │   ├── AuthContext.tsx
    │   └── RequireAuth.tsx
    ├── api/
    │   ├── client.ts
    │   ├── client.test.ts
    │   └── seasonings.ts
    ├── lib/
    │   └── queryClient.ts
    ├── hooks/
    │   ├── useSeasonings.ts
    │   ├── useCreateSeasoning.ts
    │   ├── useUpdateSeasoning.ts
    │   ├── useDeleteSeasoning.ts
    │   └── useOnlineStatus.ts
    ├── components/
    │   ├── AmountBar.tsx
    │   ├── AmountBar.test.tsx
    │   ├── SeasoningCard.tsx
    │   ├── SeasoningCard.test.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── OfflineBanner.tsx
    │   └── AppShell.tsx
    └── pages/
        ├── LoginPage.tsx
        ├── HomePage.tsx
        ├── AddSeasoningPage.tsx
        ├── EditSeasoningPage.tsx
        ├── AmountChangePage.tsx
        └── ShoppingListPage.tsx
```

---

## Task 0: Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Write the package manifest**

`frontend/package.json`:
```json
{
  "name": "seasoning-stock-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/query-sync-storage-persister": "^5.59.0",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-query-persist-client": "^5.59.0",
    "amazon-cognito-identity-js": "^6.3.12",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.5.4",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^3.2.7"
  }
}
```

- [ ] **Step 2: Write the TypeScript configs**

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

> Note: this frontend project's `tsc` uses `"moduleResolution": "Bundler"` on purpose — unlike `backend/`, this code is never zipped and run directly under plain Node; Vite bundles it, so `"Bundler"` resolution is the correct choice here (the backend's ESM/CJS packaging problem doesn't apply to a browser-bundled app).

- [ ] **Step 3: Write the Vite and Vitest configs**

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Seasoning Stock",
        short_name: "調味料在庫",
        description: "家庭の調味料在庫を管理する",
        theme_color: "#F5EFE6",
        background_color: "#F5EFE6",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
});
```

`frontend/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`frontend/vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write the HTML entry point, env example, and gitignore**

`frontend/index.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#F5EFE6" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon.svg" />
    <title>調味料在庫 — Seasoning Stock</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/.env.example`:
```
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

`frontend/.gitignore`:
```
node_modules/
dist/
dev-dist/
.env
*.local
```

- [ ] **Step 5: Write the app entry point and a placeholder App shell**

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light dark;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", "Yu Gothic UI",
    system-ui, sans-serif;
}
```

`frontend/src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5EFE6] text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <p>Seasoning Stock</p>
    </div>
  );
}
```

> `App.tsx` is a placeholder here — Task 4 replaces it with the real router. This step exists so `npm run build`/`npm run dev` work end-to-end after scaffolding, before any feature code exists.

- [ ] **Step 6: Install dependencies and verify the toolchain**

Run: `cd frontend && npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

Run: `npm run build`
Expected: Type-checks and builds successfully, produces a `dist/` directory.

Run: `npm test`
Expected: Vitest reports no test files found yet (expected — none exist), exits without crashing the toolchain (a nonzero exit for "no tests" is fine, matches the backend plan's Task 0 precedent).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/vitest.config.ts frontend/vitest.setup.ts frontend/index.html frontend/.env.example frontend/.gitignore frontend/src/main.tsx frontend/src/index.css frontend/src/App.tsx
git commit -m "chore: scaffold frontend Vite + React + TypeScript project"
```

---

## Task 1: Types and Tailwind Design Tokens

**Files:**
- Create: `frontend/src/types/seasoning.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/public/icon.svg`

> `Category`/`AmountLevel`/`Seasoning` types are intentionally duplicated from `backend/src/types/seasoning.ts` rather than shared via a package — frontend and backend are separately deployed units, and sharing a tiny type file isn't worth a monorepo-package setup for an app this size (YAGNI). Category colors below are copied from `backend/src/services/categoryDefaults.ts` so the two stay visually consistent.

- [ ] **Step 1: Write the shared types**

`frontend/src/types/seasoning.ts`:
```typescript
export type Category = "液体" | "チューブ" | "瓶" | "粉" | "スパイス";

export type AmountLevel = 0 | 25 | 50 | 75 | 100;

export interface Seasoning {
  id: string;
  name: string;
  category: Category;
  icon: string;
  color: string;
  amountLevel: AmountLevel;
  needsPurchase: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasoningInput {
  name: string;
  category: Category;
  memo?: string;
}

export interface UpdateSeasoningInput {
  name?: string;
  category?: Category;
  amountLevel?: AmountLevel;
  needsPurchase?: boolean;
  memo?: string;
}

export const CATEGORIES: Category[] = ["液体", "チューブ", "瓶", "粉", "スパイス"];

export const AMOUNT_LEVELS: AmountLevel[] = [0, 25, 50, 75, 100];

export const AMOUNT_LEVEL_LABELS: Record<AmountLevel, string> = {
  100: "満タン",
  75: "多い",
  50: "半分",
  25: "少ない",
  0: "なし",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  液体: "🧴",
  チューブ: "🧃",
  瓶: "🫙",
  粉: "🧂",
  スパイス: "🌶️",
};
```

- [ ] **Step 2: Write the Tailwind config with category colors and dark mode**

`frontend/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        category: {
          liquid: "#5B3714",
          tube: "#8A9A3B",
          jar: "#B23A2E",
          powder: "#E4D6A7",
          spice: "#C97A2B",
        },
        cream: "#F5EFE6",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

`frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Write a simple app icon**

`frontend/public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#F5EFE6"/>
  <rect x="40" y="28" width="16" height="14" rx="4" fill="#5B3714"/>
  <path d="M34 46h60a6 6 0 0 1 6 6v50a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10V52a6 6 0 0 1 6-6z" fill="#8A9A3B"/>
  <path d="M28 78h72v18a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10V78z" fill="#5B3714"/>
</svg>
```

> A single SVG icon (no separate PNG set) is a deliberate MVP simplification — most browsers accept SVG for PWA manifest icons; a proper multi-resolution PNG/maskable icon set is a reasonable follow-up, not a blocker for app-shell installability.

- [ ] **Step 4: Verify the build still works**

Run: `cd frontend && npm run build`
Expected: Succeeds (Tailwind processes without errors, icon is copied into `dist/`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/seasoning.ts frontend/tailwind.config.ts frontend/postcss.config.js frontend/public/icon.svg
git commit -m "feat: add shared types and Tailwind design tokens"
```

---

## Task 2: API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`
- Create: `frontend/src/api/seasonings.ts`

> Depends on `getCurrentIdToken` from `src/auth/cognitoAuth.ts`, which does not exist yet (Task 3). To keep this task self-contained and testable in isolation, `client.ts` takes a token-getter as an injectable dependency with a default that imports the real one — tests inject a fake. This avoids a forward reference to a file that doesn't exist yet while still being the final, real shape once Task 3 lands (Task 3 does not need to change this file).

- [ ] **Step 1: Write the failing test**

`frontend/src/api/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient, ApiError } from "./client";

const BASE_URL = "https://api.example.com/dev";

function makeClient(tokenGetter: () => Promise<string | null>) {
  return createApiClient({ baseUrl: BASE_URL, getIdToken: tokenGetter });
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("throws a 401 ApiError when there is no token", async () => {
    const client = makeClient(async () => null);

    await expect(client.get("/seasonings")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("attaches the Authorization header and returns parsed JSON on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: "1" }]), { status: 200 })
    );
    const client = makeClient(async () => "id-token-123");

    const result = await client.get("/seasonings");

    expect(result).toEqual([{ id: "1" }]);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/seasonings`);
    expect(init.headers.Authorization).toBe("Bearer id-token-123");
  });

  it("sends a JSON Content-Type header and body for POST", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), { status: 201 })
    );
    const client = makeClient(async () => "id-token-123");

    await client.post("/seasonings", { name: "醤油", category: "液体" });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "醤油", category: "液体" }));
  });

  it("returns undefined for a 204 response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 204 }));
    const client = makeClient(async () => "id-token-123");

    const result = await client.delete("/seasonings/1");

    expect(result).toBeUndefined();
  });

  it("throws an ApiError with the server's code/message on a 4xx/5xx response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "name is required" } }),
        { status: 400 }
      )
    );
    const client = makeClient(async () => "id-token-123");

    await expect(client.post("/seasonings", { name: "" })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "name is required",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: FAIL — `./client` module not found.

- [ ] **Step 3: Write the implementation**

`frontend/src/api/client.ts`:
```typescript
import { getCurrentIdToken } from "../auth/cognitoAuth";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiClientOptions {
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
}

interface RequestOptions {
  method: string;
  body?: unknown;
}

export function createApiClient({ baseUrl, getIdToken }: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions): Promise<T> {
    const idToken = await getIdToken();
    if (!idToken) {
      throw new ApiError(401, "UNAUTHORIZED", "not authenticated");
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${idToken}` };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const parsedBody = await response.json().catch(() => null);

    if (!response.ok) {
      const code = parsedBody?.error?.code ?? "UNKNOWN_ERROR";
      const message = parsedBody?.error?.message ?? response.statusText;
      throw new ApiError(response.status, code, message);
    }

    return parsedBody as T;
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: "GET" }),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
    delete: (path: string) => request<void>(path, { method: "DELETE" }),
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getIdToken: getCurrentIdToken,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the seasonings API wrapper (no test — thin pass-through, exercised by hook tests in Task 5)**

`frontend/src/api/seasonings.ts`:
```typescript
import { apiClient } from "./client";
import type { Seasoning, CreateSeasoningInput, UpdateSeasoningInput } from "../types/seasoning";

export const seasoningsApi = {
  list: () => apiClient.get<Seasoning[]>("/seasonings"),
  create: (input: CreateSeasoningInput) => apiClient.post<Seasoning>("/seasonings", input),
  update: (id: string, patch: UpdateSeasoningInput) =>
    apiClient.patch<Seasoning>(`/seasonings/${id}`, patch),
  remove: (id: string) => apiClient.delete(`/seasonings/${id}`),
};
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts frontend/src/api/seasonings.ts
git commit -m "feat: add API client with Cognito token injection and typed error mapping"
```

---

## Task 3: Cognito Auth Module and Context

**Files:**
- Create: `frontend/src/auth/cognitoAuth.ts`
- Create: `frontend/src/auth/cognitoAuth.test.ts`
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/auth/RequireAuth.tsx`

> No sign-up function exists here — the User Pool is admin-create-only (`terraform/cognito.tf`), so there is deliberately no `signUp()` export. This module covers exactly what the design doc's MVP scope requires: login, logout, session/token retrieval, and password reset (request code + confirm).

- [ ] **Step 1: Write the failing test**

`frontend/src/auth/cognitoAuth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const authenticateUser = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const forgotPassword = vi.fn();
const confirmPassword = vi.fn();

vi.mock("amazon-cognito-identity-js", () => {
  class CognitoUserPool {
    getCurrentUser() {
      return mockCurrentUser;
    }
  }
  class CognitoUser {
    authenticateUser = authenticateUser;
    signOut = signOut;
    getSession = getSession;
    forgotPassword = forgotPassword;
    confirmPassword = confirmPassword;
  }
  class AuthenticationDetails {}
  let mockCurrentUser: InstanceType<typeof CognitoUser> | null = null;
  return {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    __setMockCurrentUser: (user: InstanceType<typeof CognitoUser> | null) => {
      mockCurrentUser = user;
    },
  };
});

import * as cognitoLib from "amazon-cognito-identity-js";
import { login, logout, getCurrentIdToken, forgotPassword as requestReset, confirmPassword as confirmReset } from "./cognitoAuth";

describe("cognitoAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cognitoLib as unknown as { __setMockCurrentUser: (u: unknown) => void }).__setMockCurrentUser(null);
  });

  it("login resolves tokens on success", async () => {
    authenticateUser.mockImplementation((_details, callbacks) => {
      callbacks.onSuccess({
        getIdToken: () => ({ getJwtToken: () => "id-token" }),
        getAccessToken: () => ({ getJwtToken: () => "access-token" }),
        getRefreshToken: () => ({ getToken: () => "refresh-token" }),
      });
    });

    const tokens = await login("user@example.com", "password123");

    expect(tokens).toEqual({
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("login rejects with the Cognito error on failure", async () => {
    const cognitoError = new Error("Incorrect username or password.");
    authenticateUser.mockImplementation((_details, callbacks) => {
      callbacks.onFailure(cognitoError);
    });

    await expect(login("user@example.com", "wrong")).rejects.toBe(cognitoError);
  });

  it("getCurrentIdToken resolves null when there is no current user", async () => {
    const token = await getCurrentIdToken();
    expect(token).toBeNull();
  });

  it("getCurrentIdToken resolves the id token when the session is valid", async () => {
    const currentUser = {
      getSession: (callback: (err: Error | null, session: unknown) => void) => {
        callback(null, {
          isValid: () => true,
          getIdToken: () => ({ getJwtToken: () => "valid-id-token" }),
        });
      },
    };
    (cognitoLib as unknown as { __setMockCurrentUser: (u: unknown) => void }).__setMockCurrentUser(currentUser);

    const token = await getCurrentIdToken();

    expect(token).toBe("valid-id-token");
  });

  it("getCurrentIdToken resolves null when the session is invalid or errored", async () => {
    const currentUser = {
      getSession: (callback: (err: Error | null, session: unknown) => void) => {
        callback(new Error("expired"), null);
      },
    };
    (cognitoLib as unknown as { __setMockCurrentUser: (u: unknown) => void }).__setMockCurrentUser(currentUser);

    const token = await getCurrentIdToken();

    expect(token).toBeNull();
  });

  it("logout calls signOut on the current user when one exists", () => {
    const currentUser = { signOut };
    (cognitoLib as unknown as { __setMockCurrentUser: (u: unknown) => void }).__setMockCurrentUser(currentUser);

    logout();

    expect(signOut).toHaveBeenCalled();
  });

  it("requestReset resolves on forgotPassword success", async () => {
    forgotPassword.mockImplementation((callbacks) => callbacks.onSuccess());

    await expect(requestReset("user@example.com")).resolves.toBeUndefined();
  });

  it("confirmReset resolves on confirmPassword success", async () => {
    confirmPassword.mockImplementation((_code, _newPassword, callbacks) => callbacks.onSuccess());

    await expect(confirmReset("user@example.com", "123456", "NewPassw0rd")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/auth/cognitoAuth.test.ts`
Expected: FAIL — `./cognitoAuth` module not found.

- [ ] **Step 3: Write the implementation**

`frontend/src/auth/cognitoAuth.ts`:
```typescript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
});

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      },
      onFailure: (err: Error) => reject(err),
    });
  });
}

export function logout(): void {
  userPool.getCurrentUser()?.signOut();
}

export function getCurrentIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      resolve(null);
      return;
    }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}

export function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/cognitoAuth.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write the auth context (no isolated test — exercised via RequireAuth/LoginPage usage in Tasks 4/6; it's a thin wrapper around the already-tested functions above)**

`frontend/src/auth/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login as cognitoLogin, logout as cognitoLogout, getCurrentIdToken } from "./cognitoAuth";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentIdToken().then((token) => {
      setIsAuthenticated(token !== null);
      setIsLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    await cognitoLogin(email, password);
    setIsAuthenticated(true);
  }

  function logout() {
    cognitoLogout();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 6: Write the route guard**

`frontend/src/auth/RequireAuth.tsx`:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/auth/cognitoAuth.ts frontend/src/auth/cognitoAuth.test.ts frontend/src/auth/AuthContext.tsx frontend/src/auth/RequireAuth.tsx
git commit -m "feat: add Cognito auth module, context, and route guard"
```

---

## Task 4: React Query Client, Offline Persistence, and Seasoning Hooks

**Files:**
- Create: `frontend/src/lib/queryClient.ts`
- Create: `frontend/src/hooks/useSeasonings.ts`
- Create: `frontend/src/hooks/useCreateSeasoning.ts`
- Create: `frontend/src/hooks/useUpdateSeasoning.ts`
- Create: `frontend/src/hooks/useDeleteSeasoning.ts`
- Create: `frontend/src/hooks/useOnlineStatus.ts`
- Create: `frontend/src/hooks/useSeasonings.test.tsx`

> This is where §10 of the design doc ("直近在庫のオフライン閲覧") is implemented: `persistQueryClient` writes the query cache to `localStorage` on every successful fetch, so the last-known seasoning list survives a reload with no network. Only reads are persisted/available offline — mutations still require a live connection (enforced in the UI by disabling mutation controls when `useOnlineStatus()` is false, wired in Task 6+).

- [ ] **Step 1: Write the query client with persistence**

`frontend/src/lib/queryClient.ts`:
```typescript
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

if (typeof window !== "undefined") {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "seasoning-stock-cache",
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: Infinity,
  });
}
```

- [ ] **Step 2: Write the online-status hook (no isolated test — trivial browser-event wrapper, exercised visually via OfflineBanner in Task 6)**

`frontend/src/hooks/useOnlineStatus.ts`:
```typescript
import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 3: Write the failing test for the list hook**

`frontend/src/hooks/useSeasonings.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSeasonings } from "./useSeasonings";
import { seasoningsApi } from "../api/seasonings";
import type { Seasoning } from "../types/seasoning";

vi.mock("../api/seasonings", () => ({
  seasoningsApi: { list: vi.fn() },
}));

const sample: Seasoning = {
  id: "1",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 75,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSeasonings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and returns the seasoning list", async () => {
    (seasoningsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([sample]);

    const { result } = renderHook(() => useSeasonings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useSeasonings.test.tsx`
Expected: FAIL — `./useSeasonings` module not found.

- [ ] **Step 5: Write the hooks**

`frontend/src/hooks/useSeasonings.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";

export const SEASONINGS_QUERY_KEY = ["seasonings"] as const;

export function useSeasonings() {
  return useQuery({
    queryKey: SEASONINGS_QUERY_KEY,
    queryFn: seasoningsApi.list,
  });
}
```

`frontend/src/hooks/useCreateSeasoning.ts`:
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";
import type { CreateSeasoningInput } from "../types/seasoning";

export function useCreateSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSeasoningInput) => seasoningsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
```

`frontend/src/hooks/useUpdateSeasoning.ts`:
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";
import type { UpdateSeasoningInput } from "../types/seasoning";

export function useUpdateSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSeasoningInput }) =>
      seasoningsApi.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
```

`frontend/src/hooks/useDeleteSeasoning.ts`:
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";

export function useDeleteSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seasoningsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSeasonings.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/queryClient.ts frontend/src/hooks/
git commit -m "feat: add persisted query client, online-status hook, and seasoning CRUD hooks"
```

---

## Task 5: AmountBar and SeasoningCard Components

**Files:**
- Create: `frontend/src/components/AmountBar.tsx`
- Create: `frontend/src/components/AmountBar.test.tsx`
- Create: `frontend/src/components/SeasoningCard.tsx`
- Create: `frontend/src/components/SeasoningCard.test.tsx`

> Matches `調味料管理アプリ設計書.md` §11: the fill animates via a CSS `transition` on `height`/`width` whenever `amountLevel` changes — React re-renders with a new percentage and the browser animates the change, no animation library needed for this one effect.

- [ ] **Step 1: Write the failing test for AmountBar**

`frontend/src/components/AmountBar.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmountBar } from "./AmountBar";

describe("AmountBar", () => {
  it("renders the percentage and label for the given amount level", () => {
    render(<AmountBar amountLevel={75} color="#5B3714" />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("多い")).toBeInTheDocument();
  });

  it("sets the fill height proportional to the amount level", () => {
    render(<AmountBar amountLevel={50} color="#5B3714" />);

    const fill = screen.getByTestId("amount-bar-fill");
    expect(fill).toHaveStyle({ height: "50%" });
  });

  it("shows the empty label and 0% fill for amountLevel 0", () => {
    render(<AmountBar amountLevel={0} color="#5B3714" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("なし")).toBeInTheDocument();
    expect(screen.getByTestId("amount-bar-fill")).toHaveStyle({ height: "0%" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AmountBar.test.tsx`
Expected: FAIL — `./AmountBar` module not found.

- [ ] **Step 3: Write the implementation**

`frontend/src/components/AmountBar.tsx`:
```tsx
import { AMOUNT_LEVEL_LABELS, type AmountLevel } from "../types/seasoning";

interface AmountBarProps {
  amountLevel: AmountLevel;
  color: string;
}

export function AmountBar({ amountLevel, color }: AmountBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-16 w-6 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          data-testid="amount-bar-fill"
          className="absolute bottom-0 left-0 w-full transition-all duration-500 ease-out"
          style={{ height: `${amountLevel}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tabular-nums">{amountLevel}%</span>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {AMOUNT_LEVEL_LABELS[amountLevel]}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AmountBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for SeasoningCard**

`frontend/src/components/SeasoningCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasoningCard } from "./SeasoningCard";
import type { Seasoning } from "../types/seasoning";

const sample: Seasoning = {
  id: "1",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 75,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("SeasoningCard", () => {
  it("renders the name, category emoji, and amount", () => {
    render(<SeasoningCard seasoning={sample} onClick={() => {}} />);

    expect(screen.getByText("醤油")).toBeInTheDocument();
    expect(screen.getByText("🧴")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("shows a shopping badge only when needsPurchase is true", () => {
    const { rerender } = render(<SeasoningCard seasoning={sample} onClick={() => {}} />);
    expect(screen.queryByLabelText("買い物リストに追加済み")).not.toBeInTheDocument();

    rerender(<SeasoningCard seasoning={{ ...sample, needsPurchase: true }} onClick={() => {}} />);
    expect(screen.getByLabelText("買い物リストに追加済み")).toBeInTheDocument();
  });

  it("calls onClick when the card is tapped", async () => {
    const onClick = vi.fn();
    render(<SeasoningCard seasoning={sample} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: /醤油/ }));

    expect(onClick).toHaveBeenCalledWith(sample);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/SeasoningCard.test.tsx`
Expected: FAIL — `./SeasoningCard` module not found.

- [ ] **Step 7: Write the implementation**

`frontend/src/components/SeasoningCard.tsx`:
```tsx
import { AmountBar } from "./AmountBar";
import { CATEGORY_EMOJI, type Seasoning } from "../types/seasoning";

interface SeasoningCardProps {
  seasoning: Seasoning;
  onClick: (seasoning: Seasoning) => void;
}

export function SeasoningCard({ seasoning, onClick }: SeasoningCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(seasoning)}
      aria-label={seasoning.name}
      className="relative flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 transition hover:shadow-md active:scale-[0.98] dark:bg-stone-800 dark:ring-stone-700"
    >
      {seasoning.needsPurchase && (
        <span
          aria-label="買い物リストに追加済み"
          className="absolute right-2 top-2 text-lg"
        >
          🛒
        </span>
      )}
      <span className="text-3xl">{CATEGORY_EMOJI[seasoning.category]}</span>
      <span className="font-semibold text-stone-800 dark:text-stone-100">{seasoning.name}</span>
      <AmountBar amountLevel={seasoning.amountLevel} color={seasoning.color} />
    </button>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/SeasoningCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/AmountBar.tsx frontend/src/components/AmountBar.test.tsx frontend/src/components/SeasoningCard.tsx frontend/src/components/SeasoningCard.test.tsx
git commit -m "feat: add AmountBar and SeasoningCard components"
```

---

## Task 6: Router, App Shell, and Login Page

**Files:**
- Create: `frontend/src/components/AppShell.tsx`
- Create: `frontend/src/components/OfflineBanner.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/router.tsx`
- Modify: `frontend/src/App.tsx`

> `LoginPage` is the one page with meaningfully branchy logic (3 view states: sign-in, request-reset-code, confirm-reset-with-code) and no sign-up view (admin-create-only, per Task 3's note). No isolated unit test here — its logic is a thin composition of the already-tested `useAuth()`/`cognitoAuth` functions; correctness is verified in Task 10's browser smoke test.

- [ ] **Step 1: Write the offline banner**

`frontend/src/components/OfflineBanner.tsx`:
```tsx
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface OfflineBannerProps {
  lastUpdated?: string;
}

export function OfflineBanner({ lastUpdated }: OfflineBannerProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="w-full bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      オフラインです{formattedTime ? `（最終更新: ${formattedTime}）` : ""}
    </div>
  );
}
```

- [ ] **Step 2: Write the app shell**

`frontend/src/components/AppShell.tsx`:
```tsx
import { Outlet } from "react-router-dom";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5EFE6] text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <OfflineBanner />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Write the login page**

`frontend/src/pages/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { forgotPassword, confirmPassword } from "../auth/cognitoAuth";

type View = "sign-in" | "request-reset" | "confirm-reset";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setInfoMessage("確認コードをメールで送信しました");
      setView("confirm-reset");
    } catch {
      setError("確認コードの送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmPassword(email, code, newPassword);
      setInfoMessage("パスワードを更新しました。ログインしてください");
      setView("sign-in");
    } catch {
      setError("パスワードの更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-2xl font-bold">調味料在庫</h1>

      {infoMessage && <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">{infoMessage}</p>}
      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      {view === "sign-in" && (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <input
            type="password"
            required
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setView("request-reset")}
            className="text-sm text-stone-500 underline dark:text-stone-400"
          >
            パスワードを忘れた場合
          </button>
        </form>
      )}

      {view === "request-reset" && (
        <form onSubmit={handleRequestReset} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            確認コードを送信
          </button>
          <button type="button" onClick={() => setView("sign-in")} className="text-sm text-stone-500 underline dark:text-stone-400">
            ログインに戻る
          </button>
        </form>
      )}

      {view === "confirm-reset" && (
        <form onSubmit={handleConfirmReset} className="flex flex-col gap-3">
          <input
            required
            placeholder="確認コード"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <input
            type="password"
            required
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            パスワードを更新
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the router**

`frontend/src/router.tsx`:
```tsx
import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import AddSeasoningPage from "./pages/AddSeasoningPage";
import EditSeasoningPage from "./pages/EditSeasoningPage";
import AmountChangePage from "./pages/AmountChangePage";
import ShoppingListPage from "./pages/ShoppingListPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/seasonings/new", element: <AddSeasoningPage /> },
          { path: "/seasonings/:id/edit", element: <EditSeasoningPage /> },
          { path: "/seasonings/:id/amount", element: <AmountChangePage /> },
          { path: "/shopping-list", element: <ShoppingListPage /> },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 5: Rewrite App.tsx to wire providers and the router**

`frontend/src/App.tsx`:
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import { router } from "./router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

> This references `HomePage`, `AddSeasoningPage`, `EditSeasoningPage`, `AmountChangePage`, `ShoppingListPage` from `src/pages/`, which don't exist until Tasks 7-9. The build will not type-check until then — that's expected and resolved by the end of Task 9, matching how the backend plan's `handler.ts` referenced not-yet-existing pieces within a single task but the whole plan resolves by the end. Do not run `npm run build` as this task's verification step; use `npx tsc --noEmit -p tsconfig.json` scoped to files that exist, or simply proceed — Task 9's own verification step is where the full build must pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AppShell.tsx frontend/src/components/OfflineBanner.tsx frontend/src/pages/LoginPage.tsx frontend/src/router.tsx frontend/src/App.tsx
git commit -m "feat: add router, app shell, offline banner, and login page"
```

---

## Task 7: Home Page and Add Seasoning Page

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/AddSeasoningPage.tsx`

> Both pages exist now, so `router.tsx`'s remaining two references (`EditSeasoningPage`, `AmountChangePage`, `ShoppingListPage`) are still pending — the full build still won't pass until Task 9. This is fine; each task keeps moving the codebase toward a working whole, and only Task 9's verification step requires a clean `npm run build`.

- [ ] **Step 1: Write the home page**

`frontend/src/pages/HomePage.tsx`:
```tsx
import { Link, useNavigate } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { SeasoningCard } from "../components/SeasoningCard";
import type { Seasoning } from "../types/seasoning";

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useSeasonings();
  const navigate = useNavigate();

  function handleCardClick(seasoning: Seasoning) {
    navigate(`/seasonings/${seasoning.id}/amount`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">調味料</h1>
        <Link to="/shopping-list" className="text-sm underline">
          買い物リスト
        </Link>
      </div>

      {isLoading && <p className="text-center text-stone-500">読み込み中…</p>}

      {isError && (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-stone-500">読み込みに失敗しました</p>
          <button onClick={() => refetch()} className="rounded-xl bg-stone-800 px-4 py-2 text-white dark:bg-stone-100 dark:text-stone-900">
            再試行
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-stone-500">調味料がまだありません。追加しましょう</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {data.map((seasoning) => (
            <SeasoningCard key={seasoning.id} seasoning={seasoning} onClick={handleCardClick} />
          ))}
        </div>
      )}

      <Link
        to="/seasonings/new"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-stone-800 text-2xl text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        aria-label="調味料を追加"
      >
        +
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Write the add-seasoning page**

`frontend/src/pages/AddSeasoningPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateSeasoning } from "../hooks/useCreateSeasoning";
import { CATEGORIES, type Category } from "../types/seasoning";

export default function AddSeasoningPage() {
  const navigate = useNavigate();
  const createSeasoning = useCreateSeasoning();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createSeasoning.mutateAsync({ name, category });
      navigate("/", { replace: true });
    } catch {
      setError("追加に失敗しました。入力内容を確認してください");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">調味料を追加</h1>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          maxLength={30}
          placeholder="名前（例: 醤油）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={createSeasoning.isPending}
          className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          追加
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/AddSeasoningPage.tsx
git commit -m "feat: add home page (list) and add-seasoning page"
```

---

## Task 8: Amount Change Page and Edit Seasoning Page

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Create: `frontend/src/pages/AmountChangePage.tsx`
- Create: `frontend/src/pages/EditSeasoningPage.tsx`

> `AmountChangePage` is where §8/§9's core interaction lives: tapping a level saves immediately (no save button), and per the backend's already-implemented server-side rule, setting `amountLevel: 0` always forces `needsPurchase: true` regardless of what's sent — the frontend doesn't need its own copy of that rule, it just calls PATCH and re-reads the server's response.

- [ ] **Step 1: Write the confirm dialog**

`frontend/src/components/ConfirmDialog.tsx`:
```tsx
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-800">
        <p className="mb-4 text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-300 py-2 dark:border-stone-600"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2 font-semibold text-white"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the amount-change page**

`frontend/src/pages/AmountChangePage.tsx`:
```tsx
import { useNavigate, useParams, Link } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { AMOUNT_LEVELS, AMOUNT_LEVEL_LABELS, type AmountLevel } from "../types/seasoning";

export default function AmountChangePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seasonings } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();

  const seasoning = seasonings?.find((s) => s.id === id);

  if (!seasoning) {
    return <p className="text-center text-stone-500">読み込み中…</p>;
  }

  async function handleSelect(amountLevel: AmountLevel) {
    await updateSeasoning.mutateAsync({ id: seasoning!.id, patch: { amountLevel } });
    navigate("/", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{seasoning.name}</h1>
      <div className="flex flex-col gap-2">
        {AMOUNT_LEVELS.slice()
          .reverse()
          .map((level) => (
            <button
              key={level}
              onClick={() => handleSelect(level)}
              disabled={updateSeasoning.isPending}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${
                seasoning.amountLevel === level
                  ? "border-stone-800 bg-stone-100 dark:border-stone-100 dark:bg-stone-800"
                  : "border-stone-300 dark:border-stone-600"
              }`}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: seasoning.amountLevel === level ? seasoning.color : "transparent", border: `2px solid ${seasoning.color}` }}
              />
              {AMOUNT_LEVEL_LABELS[level]}
            </button>
          ))}
      </div>
      <Link to={`/seasonings/${seasoning.id}/edit`} className="text-center text-sm text-stone-500 underline dark:text-stone-400">
        編集・削除
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Write the edit-seasoning page**

`frontend/src/pages/EditSeasoningPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { useDeleteSeasoning } from "../hooks/useDeleteSeasoning";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CATEGORIES, type Category } from "../types/seasoning";

export default function EditSeasoningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seasonings } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();
  const deleteSeasoning = useDeleteSeasoning();
  const [showConfirm, setShowConfirm] = useState(false);

  const seasoning = seasonings?.find((s) => s.id === id);
  const [name, setName] = useState(seasoning?.name ?? "");
  const [category, setCategory] = useState<Category>(seasoning?.category ?? CATEGORIES[0]);

  if (!seasoning) {
    return <p className="text-center text-stone-500">読み込み中…</p>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateSeasoning.mutateAsync({ id: seasoning!.id, patch: { name, category } });
    navigate("/", { replace: true });
  }

  async function handleDelete() {
    await deleteSeasoning.mutateAsync(seasoning!.id);
    navigate("/", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">編集</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={updateSeasoning.isPending}
          className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          保存
        </button>
      </form>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-xl border border-red-600 px-4 py-3 font-semibold text-red-600"
      >
        削除
      </button>

      {showConfirm && (
        <ConfirmDialog
          message={`「${seasoning.name}」を削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/pages/AmountChangePage.tsx frontend/src/pages/EditSeasoningPage.tsx
git commit -m "feat: add amount-change page and edit/delete page"
```

---

## Task 9: Shopping List Page and Full Build Verification

**Files:**
- Create: `frontend/src/pages/ShoppingListPage.tsx`

> This is the last page `router.tsx` (Task 6) references — once this file exists, the whole app should type-check and build for the first time. Matches §9 of the design doc: manual toggle from the card list is out of this page's scope (a stretch feature the design doc doesn't require as a separate control — the amount-change flow already drives `needsPurchase` via the `amountLevel=0` server rule), and this page's own "purchased" checkbox sets `needsPurchase: false` **and** raises `amountLevel` to `100` in the same request, exactly matching the backend's documented invariant (setting `needsPurchase: false` alone while `amountLevel` stays `0` would be silently overridden back to `true` by the server).

- [ ] **Step 1: Write the shopping list page**

`frontend/src/pages/ShoppingListPage.tsx`:
```tsx
import { Link } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";

export default function ShoppingListPage() {
  const { data, isLoading } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();

  const shoppingList = data?.filter((s) => s.needsPurchase) ?? [];

  async function handlePurchased(id: string) {
    await updateSeasoning.mutateAsync({ id, patch: { needsPurchase: false, amountLevel: 100 } });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">買い物リスト</h1>
        <Link to="/" className="text-sm underline">
          一覧へ
        </Link>
      </div>

      {isLoading && <p className="text-center text-stone-500">読み込み中…</p>}

      {!isLoading && shoppingList.length === 0 && (
        <p className="py-8 text-center text-stone-500">買い物リストは空です</p>
      )}

      <ul className="flex flex-col gap-2">
        {shoppingList.map((seasoning) => (
          <li key={seasoning.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-stone-800">
            <input
              type="checkbox"
              onChange={() => handlePurchased(seasoning.id)}
              disabled={updateSeasoning.isPending}
              className="h-5 w-5"
              aria-label={`${seasoning.name} を購入済みにする`}
            />
            <span className="flex-1">{seasoning.name}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {seasoning.amountLevel === 0 ? "なし" : `${seasoning.amountLevel}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `cd frontend && npm test`
Expected: All test files pass (Tasks 2, 3, 4, 5 — 20 tests total across `client.test.ts`, `cognitoAuth.test.ts`, `useSeasonings.test.tsx`, `AmountBar.test.tsx`, `SeasoningCard.test.tsx`), 0 failures.

- [ ] **Step 3: Run the full build for the first time**

Run: `npm run build`
Expected: `tsc -b` type-checks the entire app (every page `router.tsx` references now exists) and Vite produces a `dist/` directory with no errors.

> If this fails with a type error, it means an earlier task's code doesn't quite match what a later task expects (e.g. a hook's return shape). Fix the mismatch in whichever file is actually wrong — don't paper over it with `any`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ShoppingListPage.tsx
git commit -m "feat: add shopping list page; full app now builds end-to-end"
```

---

## Task 10: PWA Manifest Check, Dark Mode Pass, and Browser Smoke Test

**Files:** none (verification and small polish only — see Step 1)

> `vite-plugin-pwa` (configured in Task 0's `vite.config.ts`) and Tailwind's `darkMode: "media"` (Task 1) already provide PWA installability and automatic dark mode via the OS preference — no new config files are needed. This task verifies both actually work and drives the real app in a browser, per this project's convention of not calling UI work done without seeing it run.

- [ ] **Step 1: Verify the production build includes a service worker and manifest**

Run: `cd frontend && npm run build && ls dist`
Expected: `dist/` contains `sw.js` (or similarly named service worker output) and `manifest.webmanifest`, alongside the usual `index.html`/`assets/`.

- [ ] **Step 2: Start the preview server and smoke-test in a real browser**

Run: `npx vite preview --port 4173` (leave running)

Using the Playwright browser tools (`mcp__playwright__browser_navigate`, `_snapshot`, `_click`, `_type`, `_take_screenshot`):
1. Navigate to `http://localhost:4173`. Expected: redirected to `/login` (no session yet), login form visible.
2. Take a screenshot. Visually confirm: warm cream background, system-font heading, no layout breakage.
3. Resize the browser to a phone viewport (e.g. 390×844) via `mcp__playwright__browser_resize`. Expected: the login form remains usable, no horizontal scroll, no overlapping elements.
4. Since there is no live Cognito user to actually sign in with in this environment (no `.env` configured, no `terraform apply` run yet), do not attempt a real login. Instead confirm: the "パスワードを忘れた場合" link switches the view to the reset-request form (`mcp__playwright__browser_click`, then `_snapshot` to confirm the email input for reset is shown), and switching back to sign-in works.
5. Stop the preview server when done.

Expected: no console errors in `mcp__playwright__browser_console_messages` beyond an expected network failure for the (unconfigured) Cognito pool ID — that's expected without a real `.env`, not a bug in this task.

> Full end-to-end verification (real login, seeing seasonings load, adding/editing/deleting, shopping list, offline reload) requires a real deployed backend + Cognito user, which depends on `terraform apply` having been run and a user created via `aws cognito-idp admin-create-user` — outside this plan's ability to do inside a sandboxed dev-server smoke test. Note this clearly in the final report rather than claiming full functional verification.

- [ ] **Step 3: Confirm dark mode CSS responds to OS preference**

Using `mcp__playwright__browser_evaluate`, run `matchMedia('(prefers-color-scheme: dark)').matches` to check the current environment's preference, then inspect via `_snapshot`/`_take_screenshot` that the page's background/text classes (`dark:bg-stone-900 dark:text-stone-100` etc., applied via Tailwind's `media`-strategy dark mode) are visually consistent with whichever mode is active — no unreadable low-contrast text in either mode.

- [ ] **Step 4: Report findings**

No commit for this task (verification only) unless Step 2 or Step 3 surfaces a real bug — if so, fix it in the relevant component/page file from an earlier task, re-run `npm test` and `npm run build`, and commit the fix with a message describing what the smoke test caught.

---

## What This Plan Does Not Cover

- **Deploying the built frontend**: uploading `dist/` to the S3 bucket and invalidating CloudFront (`aws s3 sync dist/ s3://<bucket> --delete` + `aws cloudfront create-invalidation`) is a manual post-build step, not part of this plan.
- **`terraform apply`**: this plan's `.env` values come from Terraform outputs that only exist after a real `apply`, which requires the user's own authenticated AWS session.
- **Creating the first Cognito user**: admin-create-only means someone must run `aws cognito-idp admin-create-user` (or use the console) after `apply` — this plan builds the login UI, not the user provisioning step.
- **Full end-to-end functional testing** (real login → real API calls → real DynamoDB data): requires the above three things to exist first; Task 10's browser smoke test is scoped to what's testable without them.
- **Household sharing, notifications, recipe integration, barcode/OCR/AI**: explicitly deferred in the design doc §15.
