# Seasoning Backend (Data Model / Repository / API Logic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `backend/` Lambda application logic for Seasoning Stock — types, validation, category defaults, DynamoDB repository, business-rule service layer, and the API Gateway Lambda handler — fully unit-tested without any real AWS resources.

**Architecture:** A single Lambda function (`src/handler.ts`) routes `GET/POST/PATCH/DELETE /seasonings[/{id}]`. It resolves the caller's identity via `getUserId()` (abstraction over the Cognito JWT claims injected by API Gateway's Cognito Authorizer), delegates to `SeasoningService` for validation and business rules, which in turn calls `SeasoningRepository` (implements `SeasoningRepositoryPort`) for DynamoDB access. The repository does full-item reads/writes (`GetCommand`/`PutCommand`/`DeleteCommand` with condition expressions) rather than partial `UpdateCommand` — the service does read-modify-write and always recomputes `updatedAt`, which keeps the "amountLevel=0 forces needsPurchase=true" business rule in one place instead of split across a DynamoDB update expression. `SeasoningRepositoryPort` is a plain interface so tests can pass in-memory fakes instead of mocking AWS.

**Out of scope for this plan** (separate plans will cover these): Terraform infra (Cognito User Pool, API Gateway, DynamoDB table, CloudFront/S3), wiring API Gateway's Cognito Authorizer to exclude `OPTIONS`, and the React frontend. This plan only produces `backend/` application code, runnable and testable locally with `npm test`.

**Tech Stack:** TypeScript, Vitest, `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` (AWS SDK v3), `aws-sdk-client-mock` (DynamoDB test doubles), `ulid` (ID generation), `@types/aws-lambda`.

---

## Task 0: Project Scaffolding

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `.gitignore` (repo root)

- [ ] **Step 1: Create the backend package manifest**

`backend/package.json`:
```json
{
  "name": "seasoning-stock-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.632.0",
    "@aws-sdk/lib-dynamodb": "^3.632.0",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/node": "^20.14.0",
    "aws-sdk-client-mock": "^4.0.1",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create the TypeScript config**

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create the Vitest config**

`backend/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Add a root .gitignore**

`.gitignore` (repo root):
```
node_modules/
dist/
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `cd backend && npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 6: Verify the test runner works with zero tests**

Run: `cd backend && npm test`
Expected: Vitest reports "No test files found" (or exits 0) — confirms the toolchain is wired correctly before any code exists.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/vitest.config.ts .gitignore
git commit -m "chore: scaffold backend TypeScript + Vitest project"
```

---

## Task 1: Core Types

**Files:**
- Create: `backend/src/types/seasoning.ts`

- [ ] **Step 1: Write the type definitions**

`backend/src/types/seasoning.ts`:
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
```

> No test for this step — pure type declarations have no runtime behavior to assert.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/seasoning.ts
git commit -m "feat: add Seasoning core types"
```

---

## Task 2: API Error Type

**Files:**
- Create: `backend/src/errors/apiError.ts`
- Test: `backend/src/errors/apiError.test.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/errors/apiError.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { ApiError, badRequest, notFound, conflict } from "./apiError";

describe("ApiError", () => {
  it("badRequest produces a 400 VALIDATION_ERROR", () => {
    const error = badRequest("name is required");
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("name is required");
  });

  it("notFound produces a 404 NOT_FOUND", () => {
    const error = notFound("seasoning missing");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("conflict produces a 409 CONFLICT", () => {
    const error = conflict("seasoning exists");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/errors/apiError.test.ts`
Expected: FAIL — `./apiError` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/errors/apiError.ts`:
```typescript
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

export const badRequest = (message: string): ApiError =>
  new ApiError(400, "VALIDATION_ERROR", message);

export const notFound = (message: string): ApiError =>
  new ApiError(404, "NOT_FOUND", message);

export const conflict = (message: string): ApiError =>
  new ApiError(409, "CONFLICT", message);

export const unauthorized = (message: string): ApiError =>
  new ApiError(401, "UNAUTHORIZED", message);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/errors/apiError.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/errors/apiError.ts backend/src/errors/apiError.test.ts
git commit -m "feat: add ApiError type and factory helpers"
```

---

## Task 3: getUserId Auth Abstraction

**Files:**
- Create: `backend/src/auth/getUserId.ts`
- Test: `backend/src/auth/getUserId.test.ts`

> This isolates "how we identify the current user" behind one function, per the design doc's requirement to abstract user identity so Cognito details don't leak elsewhere. It reads `sub` from the claims that API Gateway's Cognito Authorizer injects into `event.requestContext.authorizer.claims`.

- [ ] **Step 1: Write the failing test**

`backend/src/auth/getUserId.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { getUserId } from "./getUserId";

function eventWithClaims(claims: Record<string, string> | undefined): APIGatewayProxyEvent {
  return {
    requestContext: {
      authorizer: claims ? { claims } : undefined,
    },
  } as unknown as APIGatewayProxyEvent;
}

describe("getUserId", () => {
  it("returns the sub claim when present", () => {
    const event = eventWithClaims({ sub: "user-123", email: "a@example.com" });
    expect(getUserId(event)).toBe("user-123");
  });

  it("throws 401 when authorizer claims are missing", () => {
    const event = eventWithClaims(undefined);
    expect(() => getUserId(event)).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("throws 401 when sub is missing from claims", () => {
    const event = eventWithClaims({ email: "a@example.com" });
    expect(() => getUserId(event)).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/auth/getUserId.test.ts`
Expected: FAIL — `./getUserId` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/auth/getUserId.ts`:
```typescript
import type { APIGatewayProxyEvent } from "aws-lambda";
import { unauthorized } from "../errors/apiError";

export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims as
    | Record<string, string>
    | undefined;
  const sub = claims?.sub;

  if (!sub) {
    throw unauthorized("missing or invalid authentication");
  }

  return sub;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/auth/getUserId.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/getUserId.ts backend/src/auth/getUserId.test.ts
git commit -m "feat: add getUserId auth abstraction over Cognito claims"
```

---

## Task 4: Category Defaults (icon / color)

**Files:**
- Create: `backend/src/services/categoryDefaults.ts`
- Test: `backend/src/services/categoryDefaults.test.ts`

> Design doc requires `icon`/`color` to be server-decided from `category`, never client-supplied.

- [ ] **Step 1: Write the failing test**

`backend/src/services/categoryDefaults.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getCategoryDefaults } from "./categoryDefaults";

describe("getCategoryDefaults", () => {
  it("returns an icon and HEX color for every category", () => {
    const categories = ["液体", "チューブ", "瓶", "粉", "スパイス"] as const;
    for (const category of categories) {
      const defaults = getCategoryDefaults(category);
      expect(defaults.icon).toEqual(expect.any(String));
      expect(defaults.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("returns the documented default for 液体", () => {
    expect(getCategoryDefaults("液体")).toEqual({ icon: "liquid", color: "#5B3714" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/categoryDefaults.test.ts`
Expected: FAIL — `./categoryDefaults` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/services/categoryDefaults.ts`:
```typescript
import type { Category } from "../types/seasoning";

interface CategoryDefault {
  icon: string;
  color: string;
}

const CATEGORY_DEFAULTS: Record<Category, CategoryDefault> = {
  液体: { icon: "liquid", color: "#5B3714" },
  チューブ: { icon: "tube", color: "#8A9A3B" },
  瓶: { icon: "jar", color: "#B23A2E" },
  粉: { icon: "powder", color: "#E4D6A7" },
  スパイス: { icon: "spice", color: "#C97A2B" },
};

export function getCategoryDefaults(category: Category): CategoryDefault {
  return CATEGORY_DEFAULTS[category];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/categoryDefaults.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/categoryDefaults.ts backend/src/services/categoryDefaults.test.ts
git commit -m "feat: add server-side icon/color defaults per category"
```

---

## Task 5: Input Validation

**Files:**
- Create: `backend/src/services/validation.ts`
- Test: `backend/src/services/validation.test.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/services/validation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  validateName,
  validateCategory,
  validateMemo,
  validateAmountLevel,
} from "./validation";

describe("validateName", () => {
  it("accepts a 1-30 character string", () => {
    expect(validateName("醤油")).toBe("醤油");
  });

  it("rejects an empty string", () => {
    expect(() => validateName("")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("rejects a string longer than 30 characters", () => {
    expect(() => validateName("あ".repeat(31))).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("rejects non-string input", () => {
    expect(() => validateName(123)).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateCategory", () => {
  it("accepts a defined category", () => {
    expect(validateCategory("液体")).toBe("液体");
  });

  it("rejects an unknown category", () => {
    expect(() => validateCategory("野菜")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateMemo", () => {
  it("allows undefined", () => {
    expect(validateMemo(undefined)).toBeUndefined();
  });

  it("allows an empty string", () => {
    expect(validateMemo("")).toBe("");
  });

  it("rejects a string longer than 200 characters", () => {
    expect(() => validateMemo("あ".repeat(201))).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateAmountLevel", () => {
  it("accepts each of the five allowed levels", () => {
    for (const level of [0, 25, 50, 75, 100]) {
      expect(validateAmountLevel(level)).toBe(level);
    }
  });

  it("rejects a value outside the allowed set", () => {
    expect(() => validateAmountLevel(60)).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/validation.test.ts`
Expected: FAIL — `./validation` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/services/validation.ts`:
```typescript
import type { AmountLevel, Category } from "../types/seasoning";
import { badRequest } from "../errors/apiError";

const CATEGORIES: Category[] = ["液体", "チューブ", "瓶", "粉", "スパイス"];
const AMOUNT_LEVELS: AmountLevel[] = [0, 25, 50, 75, 100];

export function validateName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 30) {
    throw badRequest("name must be a string between 1 and 30 characters");
  }
  return name;
}

export function validateCategory(category: unknown): Category {
  if (typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
    throw badRequest(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return category as Category;
}

export function validateMemo(memo: unknown): string | undefined {
  if (memo === undefined) {
    return undefined;
  }
  if (typeof memo !== "string" || memo.length > 200) {
    throw badRequest("memo must be a string with at most 200 characters");
  }
  return memo;
}

export function validateAmountLevel(amountLevel: unknown): AmountLevel {
  if (typeof amountLevel !== "number" || !AMOUNT_LEVELS.includes(amountLevel as AmountLevel)) {
    throw badRequest(`amountLevel must be one of: ${AMOUNT_LEVELS.join(", ")}`);
  }
  return amountLevel as AmountLevel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/validation.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/validation.ts backend/src/services/validation.test.ts
git commit -m "feat: add input validation for name/category/memo/amountLevel"
```

---

## Task 6: DynamoDB Repository

**Files:**
- Create: `backend/src/repository/seasoningRepository.ts`
- Test: `backend/src/repository/seasoningRepository.test.ts`

> Exposes `SeasoningRepositoryPort` (a plain interface) alongside the concrete `SeasoningRepository` class so `SeasoningService` (Task 7) can be tested with an in-memory fake instead of mocking AWS.

- [ ] **Step 1: Write the failing test**

`backend/src/repository/seasoningRepository.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SeasoningRepository } from "./seasoningRepository";
import type { Seasoning } from "../types/seasoning";

const ddbMock = mockClient(DynamoDBDocumentClient);

function createClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
}

const sampleSeasoning: Seasoning = {
  id: "01JABC123",
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

describe("SeasoningRepository", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("lists seasonings for a user via a PK query", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ PK: "USER#user-1", SK: "SEASONING#01JABC123", ...sampleSeasoning }],
    });

    const repository = new SeasoningRepository(createClient());
    const result = await repository.list("user-1");

    expect(result).toEqual([sampleSeasoning]);
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: { ":pk": "USER#user-1", ":skPrefix": "SEASONING#" },
    });
  });

  it("gets a single seasoning by id", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { PK: "USER#user-1", SK: "SEASONING#01JABC123", ...sampleSeasoning },
    });

    const repository = new SeasoningRepository(createClient());
    const result = await repository.get("user-1", "01JABC123");

    expect(result).toEqual(sampleSeasoning);
  });

  it("returns undefined when the seasoning does not exist", async () => {
    ddbMock.on(GetCommand).resolves({});

    const repository = new SeasoningRepository(createClient());
    const result = await repository.get("user-1", "missing");

    expect(result).toBeUndefined();
  });

  it("creates a seasoning with an attribute_not_exists condition", async () => {
    ddbMock.on(PutCommand).resolves({});

    const repository = new SeasoningRepository(createClient());
    await repository.create("user-1", sampleSeasoning);

    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input).toMatchObject({
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    });
  });

  it("throws a 409 conflict when creating a duplicate id", async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({ message: "conflict", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.create("user-1", sampleSeasoning)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("throws a 404 when updating a seasoning that does not exist", async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({ message: "missing", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.update("user-1", sampleSeasoning)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws a 404 when deleting a seasoning that does not exist", async () => {
    ddbMock.on(DeleteCommand).rejects(
      new ConditionalCheckFailedException({ message: "missing", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.delete("user-1", "01JABC123")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repository/seasoningRepository.test.ts`
Expected: FAIL — `./seasoningRepository` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/repository/seasoningRepository.ts`:
```typescript
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { Seasoning } from "../types/seasoning";
import { conflict, notFound } from "../errors/apiError";

const TABLE_NAME = process.env.TABLE_NAME ?? "Seasonings";

export interface SeasoningRepositoryPort {
  list(userId: string): Promise<Seasoning[]>;
  get(userId: string, id: string): Promise<Seasoning | undefined>;
  create(userId: string, seasoning: Seasoning): Promise<void>;
  update(userId: string, seasoning: Seasoning): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}

function toItem(userId: string, seasoning: Seasoning): Record<string, unknown> {
  return {
    PK: `USER#${userId}`,
    SK: `SEASONING#${seasoning.id}`,
    ...seasoning,
  };
}

function fromItem(item: Record<string, unknown>): Seasoning {
  const { PK, SK, ...rest } = item;
  return rest as Seasoning;
}

export class SeasoningRepository implements SeasoningRepositoryPort {
  constructor(private readonly client: DynamoDBDocumentClient) {}

  async list(userId: string): Promise<Seasoning[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": "SEASONING#",
        },
      })
    );
    return (result.Items ?? []).map(fromItem);
  }

  async get(userId: string, id: string): Promise<Seasoning | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `SEASONING#${id}` },
      })
    );
    return result.Item ? fromItem(result.Item) : undefined;
  }

  async create(userId: string, seasoning: Seasoning): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: toItem(userId, seasoning),
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw conflict(`seasoning ${seasoning.id} already exists`);
      }
      throw error;
    }
  }

  async update(userId: string, seasoning: Seasoning): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: toItem(userId, seasoning),
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw notFound(`seasoning ${seasoning.id} not found`);
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `SEASONING#${id}` },
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw notFound(`seasoning ${id} not found`);
      }
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/repository/seasoningRepository.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/repository/seasoningRepository.ts backend/src/repository/seasoningRepository.test.ts
git commit -m "feat: add DynamoDB SeasoningRepository with condition expressions"
```

---

## Task 7: Seasoning Service (business rules)

**Files:**
- Create: `backend/src/services/seasoningService.ts`
- Test: `backend/src/services/seasoningService.test.ts`

> This is where the design doc's most important server-side rule lives: after applying a PATCH, if `amountLevel === 0` then `needsPurchase` is forced to `true`, even if the client explicitly sent `needsPurchase: false`. Marking an item "purchased" only works if the same request also raises `amountLevel` above 0.

- [ ] **Step 1: Write the failing test**

`backend/src/services/seasoningService.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { SeasoningService } from "./seasoningService";
import type { SeasoningRepositoryPort } from "../repository/seasoningRepository";
import type { Seasoning } from "../types/seasoning";

function makeRepository(
  overrides: Partial<SeasoningRepositoryPort> = {}
): SeasoningRepositoryPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const existingSeasoning: Seasoning = {
  id: "01JABC123",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 25,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("SeasoningService.create", () => {
  it("assigns server-side defaults and persists the seasoning", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    const result = await service.create("user-1", { name: "醤油", category: "液体" });

    expect(result.amountLevel).toBe(100);
    expect(result.needsPurchase).toBe(false);
    expect(result.icon).toBe("liquid");
    expect(result.color).toBe("#5B3714");
    expect(result.id).toEqual(expect.any(String));
    expect(repository.create).toHaveBeenCalledWith("user-1", result);
  });

  it("rejects an invalid name", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    await expect(
      service.create("user-1", { name: "", category: "液体" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SeasoningService.update", () => {
  it("throws 404 when the seasoning does not exist", async () => {
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(undefined) });
    const service = new SeasoningService(repository);

    await expect(
      service.update("user-1", "missing-id", { amountLevel: 50 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("normalizes needsPurchase to true when amountLevel is set to 0", async () => {
    const repository = makeRepository({
      get: vi.fn().mockResolvedValue(existingSeasoning),
    });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", existingSeasoning.id, {
      amountLevel: 0,
      needsPurchase: false,
    });

    expect(result.amountLevel).toBe(0);
    expect(result.needsPurchase).toBe(true);
    expect(repository.update).toHaveBeenCalledWith("user-1", result);
  });

  it("allows marking as purchased only when amountLevel is raised above 0", async () => {
    const zeroStock: Seasoning = { ...existingSeasoning, amountLevel: 0, needsPurchase: true };
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(zeroStock) });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", zeroStock.id, {
      amountLevel: 100,
      needsPurchase: false,
    });

    expect(result.amountLevel).toBe(100);
    expect(result.needsPurchase).toBe(false);
  });

  it("keeps needsPurchase true if amountLevel stays 0 and only needsPurchase is patched", async () => {
    const zeroStock: Seasoning = { ...existingSeasoning, amountLevel: 0, needsPurchase: true };
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(zeroStock) });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", zeroStock.id, { needsPurchase: false });

    expect(result.amountLevel).toBe(0);
    expect(result.needsPurchase).toBe(true);
  });

  it("recomputes icon/color when category changes", async () => {
    const repository = makeRepository({
      get: vi.fn().mockResolvedValue(existingSeasoning),
    });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", existingSeasoning.id, {
      category: "スパイス",
    });

    expect(result.category).toBe("スパイス");
    expect(result.icon).toBe("spice");
    expect(result.color).toBe("#C97A2B");
  });
});

describe("SeasoningService.delete", () => {
  it("delegates to the repository", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    await service.delete("user-1", "01JABC123");

    expect(repository.delete).toHaveBeenCalledWith("user-1", "01JABC123");
  });
});

describe("SeasoningService.list", () => {
  it("delegates to the repository", async () => {
    const repository = makeRepository({ list: vi.fn().mockResolvedValue([existingSeasoning]) });
    const service = new SeasoningService(repository);

    const result = await service.list("user-1");

    expect(result).toEqual([existingSeasoning]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/seasoningService.test.ts`
Expected: FAIL — `./seasoningService` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/services/seasoningService.ts`:
```typescript
import { ulid } from "ulid";
import type {
  Seasoning,
  CreateSeasoningInput,
  UpdateSeasoningInput,
} from "../types/seasoning";
import type { SeasoningRepositoryPort } from "../repository/seasoningRepository";
import { getCategoryDefaults } from "./categoryDefaults";
import {
  validateName,
  validateCategory,
  validateMemo,
  validateAmountLevel,
} from "./validation";
import { notFound } from "../errors/apiError";

export class SeasoningService {
  constructor(private readonly repository: SeasoningRepositoryPort) {}

  async list(userId: string): Promise<Seasoning[]> {
    return this.repository.list(userId);
  }

  async create(userId: string, input: CreateSeasoningInput): Promise<Seasoning> {
    const name = validateName(input.name);
    const category = validateCategory(input.category);
    const memo = validateMemo(input.memo);
    const defaults = getCategoryDefaults(category);
    const now = new Date().toISOString();

    const seasoning: Seasoning = {
      id: ulid(),
      name,
      category,
      icon: defaults.icon,
      color: defaults.color,
      amountLevel: 100,
      needsPurchase: false,
      memo,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(userId, seasoning);
    return seasoning;
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateSeasoningInput
  ): Promise<Seasoning> {
    const existing = await this.repository.get(userId, id);
    if (!existing) {
      throw notFound(`seasoning ${id} not found`);
    }

    const merged: Seasoning = { ...existing };

    if (patch.name !== undefined) {
      merged.name = validateName(patch.name);
    }
    if (patch.category !== undefined) {
      merged.category = validateCategory(patch.category);
      const defaults = getCategoryDefaults(merged.category);
      merged.icon = defaults.icon;
      merged.color = defaults.color;
    }
    if (patch.memo !== undefined) {
      merged.memo = validateMemo(patch.memo);
    }
    if (patch.amountLevel !== undefined) {
      merged.amountLevel = validateAmountLevel(patch.amountLevel);
    }
    if (patch.needsPurchase !== undefined) {
      merged.needsPurchase = patch.needsPurchase;
    }

    // Server-side invariant: amountLevel=0 always implies needsPurchase=true.
    // "Mark as purchased" must raise amountLevel in the same request, or this wins.
    if (merged.amountLevel === 0) {
      merged.needsPurchase = true;
    }

    merged.updatedAt = new Date().toISOString();

    await this.repository.update(userId, merged);
    return merged;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.repository.delete(userId, id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/seasoningService.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/seasoningService.ts backend/src/services/seasoningService.test.ts
git commit -m "feat: add SeasoningService with amountLevel/needsPurchase normalization"
```

---

## Task 8: Lambda Handler (routing, CORS, error mapping)

**Files:**
- Create: `backend/src/handler.ts`
- Test: `backend/src/handler.test.ts`

> `OPTIONS` is handled here without calling `getUserId()`, so the Lambda code never requires auth for preflight. (Excluding the Cognito Authorizer from the `OPTIONS` method at the API Gateway level is a Terraform concern, covered in the infra plan — this is defense in depth on the code side.) Every response, including errors, includes CORS headers.

- [ ] **Step 1: Write the failing test**

`backend/src/handler.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);

function baseEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/seasonings",
    pathParameters: null,
    body: null,
    requestContext: {
      authorizer: { claims: { sub: "user-1" } },
    },
    ...overrides,
  } as unknown as APIGatewayProxyEvent;
}

describe("handler", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("returns 200 with CORS headers for OPTIONS without requiring auth", async () => {
    const event = baseEvent({ httpMethod: "OPTIONS", requestContext: {} as never });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns 401 with CORS headers when unauthenticated", async () => {
    const event = baseEvent({ requestContext: {} as never });
    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("lists seasonings on GET /seasonings", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(baseEvent({ httpMethod: "GET" }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  it("creates a seasoning on POST /seasonings", async () => {
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(
      baseEvent({
        httpMethod: "POST",
        body: JSON.stringify({ name: "醤油", category: "液体" }),
      })
    );

    expect(result.statusCode).toBe(201);
    const created = JSON.parse(result.body);
    expect(created.name).toBe("醤油");
    expect(created.amountLevel).toBe(100);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns 400 with CORS headers for invalid POST input", async () => {
    const result = await handler(
      baseEvent({ httpMethod: "POST", body: JSON.stringify({ name: "" }) })
    );

    expect(result.statusCode).toBe(400);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
    expect(JSON.parse(result.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown route", async () => {
    const result = await handler(baseEvent({ httpMethod: "PUT" }));

    expect(result.statusCode).toBe(404);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/handler.test.ts`
Expected: FAIL — `./handler` module not found.

- [ ] **Step 3: Write the implementation**

`backend/src/handler.ts`:
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SeasoningRepository } from "./repository/seasoningRepository";
import { SeasoningService } from "./services/seasoningService";
import { getUserId } from "./auth/getUserId";
import { ApiError } from "./errors/apiError";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repository = new SeasoningRepository(dynamoClient);
const service = new SeasoningService(repository);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function noBody(statusCode: number): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders(), body: "" };
}

function errorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof ApiError) {
    return json(error.statusCode, { error: { code: error.code, message: error.message } });
  }
  console.error(error);
  return json(500, {
    error: { code: "INTERNAL_ERROR", message: "internal server error" },
  });
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === "OPTIONS") {
    return noBody(200);
  }

  try {
    const userId = getUserId(event);
    const id = event.pathParameters?.id;

    if (event.httpMethod === "GET" && !id) {
      const items = await service.list(userId);
      return json(200, items);
    }

    if (event.httpMethod === "POST" && !id) {
      const input = JSON.parse(event.body ?? "{}");
      const created = await service.create(userId, input);
      return json(201, created);
    }

    if (event.httpMethod === "PATCH" && id) {
      const patch = JSON.parse(event.body ?? "{}");
      const updated = await service.update(userId, id, patch);
      return json(200, updated);
    }

    if (event.httpMethod === "DELETE" && id) {
      await service.delete(userId, id);
      return noBody(204);
    }

    return json(404, { error: { code: "NOT_FOUND", message: "route not found" } });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/handler.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handler.ts backend/src/handler.test.ts
git commit -m "feat: add Lambda handler with routing, CORS, and error mapping"
```

---

## Task 9: Full Suite Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire backend test suite**

Run: `cd backend && npm test`
Expected: All test files pass (Task 2, 3, 4, 5, 6, 7, 8 — 38 tests total), 0 failures.

- [ ] **Step 2: Type-check the whole project**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit (only if anything was left uncommitted)**

```bash
git status
```
If clean, no commit needed — this task is a checkpoint, not a code change.

---

## What This Plan Does Not Cover

- **Terraform / infra:** Cognito User Pool + Client, API Gateway (Cognito Authorizer wired to exclude `OPTIONS`, CORS at the gateway level), DynamoDB table, Lambda deployment, S3 + CloudFront. Needs its own plan.
- **Frontend:** React app, login screen, cards UI, offline persistence (React Query + IndexedDB), API client. Needs its own plan.
- **Local end-to-end run:** Running the Lambda against a real or local-emulated DynamoDB (e.g. DynamoDB Local) is not part of this plan — everything here is verified with mocks. Wire-level integration testing belongs in the infra plan once real resources exist.
