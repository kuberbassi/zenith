import crypto from 'node:crypto'
import { ENV } from '../config/env.js'

const SECRET_PREFIX = 'enc:v1:'

function getSecretKey(): Buffer {
  return crypto.createHash('sha256').update(ENV.JWT_SECRET).digest()
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${SECRET_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(SECRET_PREFIX)) return value
  const payload = value.slice(SECRET_PREFIX.length)
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted secret format')

  const decipher = crypto.createDecipheriv('aes-256-gcm', getSecretKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(SECRET_PREFIX)
}
