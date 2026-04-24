/**
 * ============================================================================
 * AltDesk — Módulo de Criptografia para Segredos
 * ============================================================================
 * 
 * Usa AES-256-GCM para encriptar/desencriptar passwords e tokens OAuth.
 * 
 * REGRA DO SPEC: "Segredos nunca em plaintext na BD"
 * 
 * A chave de encriptação vem de process.env.ENCRYPTION_KEY (deve ter 32 bytes).
 * Se não existir, gera um aviso e usa uma chave default (APENAS para dev).
 * 
 * ⚠️ Em produção, ENCRYPTION_KEY DEVE ser definida como variável de ambiente!
 */

import crypto from "crypto";
import { logger } from "./logger.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;        // 16 bytes para AES GCM
const AUTH_TAG_LENGTH = 16;  // 16 bytes para o authentication tag
const KEY_LENGTH = 32;       // 32 bytes = 256 bits

/**
 * Obtém a chave de encriptação.
 * Em produção, deve vir de ENCRYPTION_KEY no .env (hex string de 64 chars ou base64 de 44 chars).
 * Em dev, gera uma chave derivada de uma string default (NÃO seguro para produção!).
 */
function getEncryptionKey(): Buffer {
    const envKey = process.env.ENCRYPTION_KEY;

    if (envKey) {
        // Tenta interpretar como hex (64 chars) ou base64 (44 chars)
        if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
            return Buffer.from(envKey, "hex");
        }
        // Tenta base64
        const b64 = Buffer.from(envKey, "base64");
        if (b64.length === KEY_LENGTH) {
            return b64;
        }
        // Fallback: derivar da string via SHA-256
        return crypto.createHash("sha256").update(envKey).digest();
    }

    // ⚠️ Dev-only fallback — NÃO usar em produção!
    if (process.env.NODE_ENV !== "production") {
        logger.warn("[Encryption] ENCRYPTION_KEY not set — using dev fallback. Set it for production!");
        return crypto.createHash("sha256").update("altdesk-dev-key-DO-NOT-USE-IN-PROD").digest();
    }

    throw new Error(
        "[Encryption] ENCRYPTION_KEY must be set in production! " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
}

/**
 * Encripta um texto com AES-256-GCM.
 * 
 * Formato de saída: iv:authTag:ciphertext (tudo em hex, separado por ":")
 * 
 * @param plaintext - O texto a encriptar (ex: password IMAP, OAuth token)
 * @returns String encriptada no formato "iv:tag:cipher"
 * 
 * @example
 * const encrypted = encrypt("mySecretPassword123");
 * // Resultado: "a1b2c3...:d4e5f6...:789abc..."
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Formato: iv:authTag:ciphertext
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Desencripta um texto encriptado com AES-256-GCM.
 * 
 * @param ciphertext - String no formato "iv:tag:cipher" (output do encrypt)
 * @returns O texto original
 * @throws Error se o formato for inválido ou a chave/tag não bater
 * 
 * @example
 * const password = decrypt(encryptedPasswordFromDB);
 */
export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(":");

    if (parts.length !== 3) {
        throw new Error("[Encryption] Invalid ciphertext format — expected 'iv:tag:cipher'");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * Verifica se uma string parece ser um valor encriptado (formato iv:tag:cipher).
 * Útil para saber se um valor já foi encriptado antes de encriptar novamente.
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    if (parts.length !== 3) return false;
    // Verificar que cada parte parece ser hex
    return parts.every(p => /^[0-9a-fA-F]+$/.test(p));
}
