import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { FrameData } from "../types";

const firebaseConfig = {
  projectId: "pacific-victory-hv8b6",
  appId: "1:360223194769:web:e7619c4961fef5cbe70930",
  apiKey: "AIzaSyB5UnjmTlDY08WVcjp38XUagDzUkA5czKg",
  authDomain: "pacific-victory-hv8b6.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-d143e5f3-b981-4fc7-bc09-655672645a25");

export async function saveLearnedFrame(frame: FrameData) {
  try {
    const docRef = await addDoc(collection(db, "poses"), {
      ...frame,
      createdAt: serverTimestamp(),
      confidence: frame.landmarks[0]?.visibility || 0
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    return null;
  }
}
