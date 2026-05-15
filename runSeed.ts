import { seedDummyData } from './src/lib/seedDummyData';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

seedDummyData("zD0u2FvwVFTT9FjV4Uu7qfVb5452").then(() => {
  console.log("Done");
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
