import CryptoJS from "crypto-js";

const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY;

export function encryptSecret(secret) {
  return CryptoJS.AES.encrypt(secret, MASTER_KEY).toString();
}

export function decryptSecret(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, MASTER_KEY);

  return bytes.toString(CryptoJS.enc.Utf8);
}