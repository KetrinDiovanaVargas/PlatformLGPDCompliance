// src/services/storageService.ts
import { storage } from "../lib/firebase";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadFile(file: File, path = "uploads") {
  const storageRef = ref(storage, `${path}/${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}
