// This is a placeholder file. It will be updated after Firebase setup is complete.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export { firebaseConfig };
// Use the firestoreDatabaseId from the config
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence
// enableIndexedDbPersistence(db).catch((err) => {
//   if (err.code == 'failed-precondition') {
//     console.warn('Firebase persistence disabled: multiple tabs open');
//   } else if (err.code == 'unimplemented') {
//     console.warn('Firebase persistence not supported by current browser');
//   }
// });

export const auth = getAuth(app);
