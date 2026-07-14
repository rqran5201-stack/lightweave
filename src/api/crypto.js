/**
 * E2E encryption utilities using Web Crypto API.
 * Zero dependencies — AES-256-GCM + PBKDF2 key derivation.
 */

// --- Internal helpers ---

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode.apply(null, chunk);
  }
  return btoa(result);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ensureCrypto() {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API 不可用，请使用 HTTPS 或 localhost 访问');
  }
}

// --- Public API ---

/** Generate 16 random bytes as a hex string for PBKDF2 salt. */
export function generateSalt() {
  ensureCrypto();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Derive an AES-256-GCM CryptoKey from a password and salt using PBKDF2.
 * @param {string} password
 * @param {string} salt - hex string from generateSalt()
 * @param {number} [iterations=100000]
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt, iterations = 100000) {
  ensureCrypto();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBytes(salt);

  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw', passwordBytes, 'PBKDF2', false, ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * @param {string} plaintext
 * @param {CryptoKey} key
 * @returns {Promise<{ciphertext: string, iv: string}>} both base64-encoded
 */
export async function encryptData(plaintext, key) {
  ensureCrypto();
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @param {CryptoKey} key
 * @returns {Promise<string>} plaintext
 * @throws {Error} "密码错误" on auth tag mismatch (wrong password)
 */
export async function decryptData(ciphertextBase64, ivBase64, key) {
  ensureCrypto();
  const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(ciphertextBase64));
  const ivBytes = new Uint8Array(base64ToArrayBuffer(ivBase64));

  try {
    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ciphertextBytes
    );
    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch (e) {
    if (e.name === 'OperationError') {
      throw new Error('密码错误，请重试');
    }
    throw new Error('解密失败：文件可能已损坏');
  }
}
