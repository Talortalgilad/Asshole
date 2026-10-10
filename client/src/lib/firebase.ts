import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';

// ערכי Web config של Firebase ציבוריים בכוונה (לא סוד). ההגנה היא ב-Authorized domains וב-Firestore Rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBGIEWjTwSxjlqi7r0yav7hQPEofKQRctI',
  authDomain: 'asshole-720d9.firebaseapp.com',
  projectId: 'asshole-720d9',
  storageBucket: 'asshole-720d9.firebasestorage.app',
  messagingSenderId: '368659045190',
  appId: '1:368659045190:web:c8c699b7fe22e507f46347',
};

let cached: ReturnType<typeof getAuth> | null = null;
const auth = () => (cached ??= getAuth(initializeApp(firebaseConfig)));

export type { User };
export const watchAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth(), cb);
export const logout = () => signOut(auth());
export const getToken = async () => (await auth().currentUser?.getIdToken()) ?? '';

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth(), provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth(), provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}
