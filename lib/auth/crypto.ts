import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from "node:crypto";
const SCRYPT_OPTIONS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1
} as const;

async function derivePasswordHash(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      64,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      }
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString("hex");
  const derivedKey = await derivePasswordHash(password, salt);

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = await derivePasswordHash(password, salt);

  const storedHashBuffer = Buffer.from(hash, "hex");
  if (storedHashBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedHashBuffer);
}

export function generateSecureToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function deriveEncryptionKey(key: string) {
  return createHash("sha256").update(key).digest();
}

export function encryptSecret(plaintext: string, key: string) {
  const derivedKey = deriveEncryptionKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(encrypted: string, key: string) {
  try {
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");

    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error("Encrypted secret format is invalid.");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveEncryptionKey(key),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(
      "Failed to decrypt secret. The encryption key may be invalid or the payload may have been tampered with."
    );
  }
}

export function generateCsrfToken() {
  return generateSecureToken(32);
}
