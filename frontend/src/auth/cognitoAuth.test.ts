import { describe, it, expect, vi, beforeEach } from "vitest";

const authenticateUser = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const forgotPassword = vi.fn();
const confirmPassword = vi.fn();

vi.mock("amazon-cognito-identity-js", () => {
  let shouldThrowOnConstruct = false;
  class CognitoUserPool {
    constructor() {
      if (shouldThrowOnConstruct) {
        throw new Error("Both UserPoolId and ClientId are required.");
      }
    }
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
    __setShouldThrowOnConstruct: (value: boolean) => {
      shouldThrowOnConstruct = value;
    },
  };
});

import * as cognitoLib from "amazon-cognito-identity-js";
import { login, logout, getCurrentIdToken, forgotPassword as requestReset, confirmPassword as confirmReset } from "./cognitoAuth";

describe("cognitoAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cognitoLib as unknown as { __setMockCurrentUser: (u: unknown) => void }).__setMockCurrentUser(null);
    // Always reset, regardless of whether the previous test's assertions
    // passed -- otherwise a failing assertion in the "construction throws"
    // test below would leave every later test throwing too, masking their
    // real results behind an unrelated cascade failure.
    (cognitoLib as unknown as { __setShouldThrowOnConstruct: (v: boolean) => void }).__setShouldThrowOnConstruct(
      false
    );
  });

  it("getCurrentIdToken resolves null instead of rejecting when CognitoUserPool construction fails", async () => {
    // Runs first (before any other test's call to getUserPool() caches a
    // successfully-constructed pool as cognitoAuth.ts's module-level
    // singleton) so this exercises a genuine first-construction failure,
    // matching what happens in a real app with no .env configured.
    (cognitoLib as unknown as { __setShouldThrowOnConstruct: (v: boolean) => void }).__setShouldThrowOnConstruct(
      true
    );

    await expect(getCurrentIdToken()).resolves.toBeNull();
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
