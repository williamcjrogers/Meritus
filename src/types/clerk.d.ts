export {};

declare global {
  interface CustomJwtSessionClaims {
    /** Added by the Clerk dashboard claim {"metadata": "{{user.public_metadata}}"}. */
    metadata?: { role?: string; domain?: string; email?: string };
  }
}
