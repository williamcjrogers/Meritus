import React from 'react';
export function UserButton() { return <button type="button" aria-label="Account, local fixture">WR</button>; }
export function useClerk() { return { signOut: async callback => { if (typeof callback === 'function') await callback(); } }; }
export function useUser() { return { isLoaded: true, user: { fullName: 'William Rogers', primaryEmailAddress: { emailAddress: 'william@example.test' }, publicMetadata: { role: 'director' } } }; }
export function useAuth() { return { isLoaded: true, isSignedIn: false, userId: null }; }
export function useSignIn() { return { isLoaded: true, signIn: { create: async () => { throw new Error('Local fixture has no authentication service'); } }, setActive: async () => {} }; }
