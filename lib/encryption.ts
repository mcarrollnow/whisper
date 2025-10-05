import {
  KeyHelper,
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
  MessageType,
  SignedPublicPreKeyType,
  PreKeyType,
  StorageType,
} from '@privacyresearch/libsignal-protocol-typescript'

// Signal Protocol Store implementation matching StorageType interface
export class SignalProtocolStore implements StorageType {
  private store: Map<string, any>

  constructor() {
    this.store = new Map()
  }

  async get(key: string, defaultValue?: any): Promise<any> {
    if (this.store.has(key)) {
      return this.store.get(key)
    }
    return defaultValue
  }

  async put(key: string, value: any): Promise<void> {
    this.store.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Identity Key methods
  async getIdentityKeyPair(): Promise<any> {
    return this.get('identityKey')
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.get('registrationId')
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    direction?: string
  ): Promise<boolean> {
    const trusted = await this.get(`identity_${identifier}`)
    if (trusted === undefined) {
      return true
    }
    return this.arrayBufferEquals(identityKey, trusted)
  }

  async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    const existing = await this.get(`identity_${identifier}`)
    await this.put(`identity_${identifier}`, identityKey)

    if (existing && !this.arrayBufferEquals(identityKey, existing)) {
      return true // Identity changed
    }
    return false // Identity same or new
  }

  // PreKey methods
  async loadPreKey(keyId: string | number): Promise<any> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    const preKey = await this.get(`prekey_${id}`)
    if (!preKey) {
      return undefined
    }
    return {
      pubKey: preKey.pubKey,
      privKey: preKey.privKey,
    }
  }

  async storePreKey(keyId: string | number, keyPair: any): Promise<void> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    await this.put(`prekey_${id}`, keyPair)
  }

  async removePreKey(keyId: string | number): Promise<void> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    await this.remove(`prekey_${id}`)
  }

  // SignedPreKey methods
  async loadSignedPreKey(keyId: string | number): Promise<any> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    const signedPreKey = await this.get(`signedprekey_${id}`)
    if (!signedPreKey) {
      return undefined
    }
    return {
      pubKey: signedPreKey.pubKey,
      privKey: signedPreKey.privKey,
    }
  }

  async storeSignedPreKey(keyId: string | number, keyPair: any): Promise<void> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    await this.put(`signedprekey_${id}`, keyPair)
  }

  async removeSignedPreKey(keyId: string | number): Promise<void> {
    const id = typeof keyId === 'string' ? parseInt(keyId) : keyId
    await this.remove(`signedprekey_${id}`)
  }

  // Session methods
  async loadSession(identifier: string): Promise<any> {
    return this.get(`session_${identifier}`)
  }

  async storeSession(identifier: string, record: any): Promise<void> {
    await this.put(`session_${identifier}`, record)
  }

  async removeSession(identifier: string): Promise<void> {
    await this.remove(`session_${identifier}`)
  }

  async removeAllSessions(identifier: string): Promise<void> {
    const keys = Array.from(this.store.keys())
    for (const key of keys) {
      if (key.startsWith(`session_${identifier}`)) {
        await this.remove(key)
      }
    }
  }

  // Helper methods
  private arrayBufferEquals(buf1: ArrayBuffer, buf2: ArrayBuffer): boolean {
    if (buf1.byteLength !== buf2.byteLength) return false
    const view1 = new Uint8Array(buf1)
    const view2 = new Uint8Array(buf2)
    for (let i = 0; i < view1.length; i++) {
      if (view1[i] !== view2[i]) return false
    }
    return true
  }
}

// Encryption Service
export class SignalEncryptionService {
  private store: SignalProtocolStore

  constructor() {
    this.store = new SignalProtocolStore()
  }

  getStore(): SignalProtocolStore {
    return this.store
  }

  // Initialize user with Signal Protocol keys
  async initializeUser(): Promise<{
    registrationId: number
    identityKeyPair: any
    signedPreKey: SignedPublicPreKeyType
    preKeys: PreKeyType[]
  }> {
    // Generate registration ID
    const registrationId = KeyHelper.generateRegistrationId()
    await this.store.put('registrationId', registrationId)

    // Generate identity key pair
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair()
    await this.store.put('identityKey', identityKeyPair)

    // Generate signed pre-key
    const signedPreKeyId = 1
    const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId)
    await this.store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair)

    // Generate pre-keys (batch of 10)
    const preKeys: PreKeyType[] = []
    for (let i = 1; i <= 10; i++) {
      const preKey = await KeyHelper.generatePreKey(i)
      await this.store.storePreKey(i, preKey.keyPair)
      preKeys.push({
        keyId: preKey.keyId,
        publicKey: preKey.keyPair.pubKey,
      })
    }

    return {
      registrationId,
      identityKeyPair,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.keyPair.pubKey,
        signature: signedPreKey.signature,
      },
      preKeys,
    }
  }

  // Build session with recipient
  async buildSession(
    recipientId: string,
    deviceId: number,
    preKeyBundle: {
      registrationId: number
      identityKey: ArrayBuffer
      signedPreKey: { keyId: number; publicKey: ArrayBuffer; signature: ArrayBuffer }
      preKey?: { keyId: number; publicKey: ArrayBuffer }
    }
  ): Promise<void> {
    const address = new SignalProtocolAddress(recipientId, deviceId)
    const sessionBuilder = new SessionBuilder(this.store, address)

    await sessionBuilder.processPreKey({
      registrationId: preKeyBundle.registrationId,
      identityKey: preKeyBundle.identityKey,
      signedPreKey: {
        keyId: preKeyBundle.signedPreKey.keyId,
        publicKey: preKeyBundle.signedPreKey.publicKey,
        signature: preKeyBundle.signedPreKey.signature,
      },
      preKey: preKeyBundle.preKey,
    })
  }

  // Encrypt message
  async encryptMessage(recipientId: string, deviceId: number, message: string): Promise<MessageType> {
    const address = new SignalProtocolAddress(recipientId, deviceId)
    const sessionCipher = new SessionCipher(this.store, address)

    const messageBuffer = new TextEncoder().encode(message)
    return await sessionCipher.encrypt(messageBuffer.buffer)
  }

  // Decrypt message
  async decryptMessage(
    senderId: string,
    deviceId: number,
    ciphertext: { type: number; body: string }
  ): Promise<string> {
    const address = new SignalProtocolAddress(senderId, deviceId)
    const sessionCipher = new SessionCipher(this.store, address)

    let plaintextBuffer: ArrayBuffer

    if (ciphertext.type === 3) {
      // PreKeyWhisperMessage - establishes new session
      plaintextBuffer = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext.body, 'binary')
    } else if (ciphertext.type === 1) {
      // WhisperMessage - existing session
      plaintextBuffer = await sessionCipher.decryptWhisperMessage(ciphertext.body, 'binary')
    } else {
      throw new Error('Unknown message type')
    }

    return new TextDecoder().decode(plaintextBuffer)
  }

  // Helper: Convert ArrayBuffer to Base64
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // Helper: Convert Base64 to ArrayBuffer
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}

// Export singleton instance
export const signalEncryption = new SignalEncryptionService()
