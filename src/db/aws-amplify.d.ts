import { RequestInit } from "node-fetch";

type KeyValue = { [key: string]: any };

/**
 * Partial type for Cognito user fields that we actually use.
 */
export interface CognitoUserPartial {
  attributes: {
    sub: string;
    email_verified: boolean;
    email: string;
  };
}

/**
 * Ad-hoc type for the object returned from `Auth.currentAuthenticatedUser()`
 * in `aws-amplify` v3.3.21.
 */
export interface CognitoUser extends CognitoUserPartial {
  username: string;
  pool: {
    userPoolId: string;
    clientId: string;
    client: {
        endpoint: string;
        fetchOptions: RequestInit
    };
    advancedSecurityDataCollectionFlag: boolean;
    storage: KeyValue;
  };
  Session: object | null;
  client: {
    endpoint: string;
    fetchOptions: RequestInit
  };
  signInUserSession: {
    idToken: {
      jwtToken: string;
      payload: {
        sub: string;
        aud: string;
        email_verified: boolean;
        event_id: string;
        token_user: string;
        auth_time: number;
        iss: string;
        exp: number;
        iat: number;
        email: string;
      };
    };
    refreshToken: {
      token: string;
    };
    accessToken: {
      jwtToken: string;
      payload: {
        sub: string;
        event_id: string;
        token_use: string;
        scope: string;
        auth_time: number;
        iss: string;
        exp: number;
        iat: number;
        jti: string;
        client_id: string;
        username: string;
      }
    },
    clockDrift: number;
  };
  authenticationFlowType: string;
  storage: KeyValue;
  keyPrefix: string;
  userDataKey: string;
  preferredMFA: string;
}
