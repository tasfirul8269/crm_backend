import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get or generate the encryption key from environment variable.
 * Falls back to a default key for development (NOT secure for production).
 */
function getEncryptionKey(): Buffer {
    const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (key && key.length === 32) {
        return Buffer.from(key, 'utf8');
    }
    // If not set or wrong length, derive a key from a default (for dev only)
    // In production, CREDENTIALS_ENCRYPTION_KEY should be set properly
    console.warn('WARNING: CREDENTIALS_ENCRYPTION_KEY not set or invalid. Using derived default key. Set a proper 32-char key for production!');
    return crypto.scryptSync('default-dev-key-not-secure', 'salt', 32);
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns a base64-encoded string containing: IV + AuthTag + Ciphertext
 */
export function encryptValue(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + Encrypted data
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
    ]);

    return combined.toString('base64');
}

/**
 * Decrypt a value that was encrypted with encryptValue.
 * Expects base64-encoded string containing: IV + AuthTag + Ciphertext
 */
export function decryptValue(encryptedData: string): string {
    try {
        const key = getEncryptionKey();
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract IV, AuthTag, and Ciphertext
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Failed to decrypt value:', error.message);
        // Return empty string on decryption failure (key mismatch, corrupted data, etc.)
        return '';
    }
}

/**
 * Check if a string appears to be an encrypted value (base64 with proper length).
 */
export function isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    // Encrypted values will be base64 and have minimum length for IV + AuthTag + some data
    const minLength = (IV_LENGTH + AUTH_TAG_LENGTH + 1) * 4 / 3; // Rough base64 estimate
    try {
        const decoded = Buffer.from(value, 'base64');
        return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
    } catch {
        return false;
    }
}
