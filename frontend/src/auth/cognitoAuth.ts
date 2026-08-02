import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

// Constructed lazily (on first actual use) rather than at module load.
// amazon-cognito-identity-js validates UserPoolId/ClientId eagerly and
// throws if either is missing, and Vite resolves this module's static
// import graph (via client.ts) even in tests that never touch Cognito.
// Deferring construction keeps module import side-effect-free.
let userPoolInstance: CognitoUserPool | null = null;

function getUserPool(): CognitoUserPool {
  if (!userPoolInstance) {
    userPoolInstance = new CognitoUserPool({
      UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
      ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
    });
  }
  return userPoolInstance;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getUserPool() });
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
  getUserPool().getCurrentUser()?.signOut();
}

export function getCurrentIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = getUserPool().getCurrentUser();
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
    const user = new CognitoUser({ Username: email, Pool: getUserPool() });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}

export function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getUserPool() });
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}
