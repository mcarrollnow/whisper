# Security & Encryption

## Overview

SecureMessenger implements the **Signal Protocol** for end-to-end encryption, the same protocol used by Signal, WhatsApp, and Facebook Messenger for secure communications.

## Signal Protocol

### What is Signal Protocol?

The Signal Protocol combines:
- **Double Ratchet Algorithm** - Forward secrecy for every message
- **Extended Triple Diffie-Hellman (X3DH)** - Session establishment
- **Prekey Mechanism** - Asynchronous messaging

### Key Features

1. **End-to-End Encryption**: Only sender and recipient can read messages
2. **Forward Secrecy**: Past messages secure even if keys compromised
3. **Future Secrecy**: Future messages secure if key material compromised
4. **Deniable Authentication**: Cannot cryptographically prove who sent a message

## How It Works

### 1. Key Generation

When a user registers, they generate:

\`\`\`
Identity Key Pair (IK)
├── Private Key (stays on device)
└── Public Key (uploaded to server)

Signed Pre-Key (SPK)
├── Private Key (stays on device)
├── Public Key (uploaded to server)
└── Signature (signed by Identity Key)

One-Time Pre-Keys (OPK)
└── 10 key pairs generated and uploaded
\`\`\`

### 2. Session Establishment (X3DH)

When Alice wants to message Bob:

\`\`\`
1. Alice fetches Bob's public keys from server:
   - Identity Key (IK_B)
   - Signed Pre-Key (SPK_B)
   - One-Time Pre-Key (OPK_B)

2. Alice performs Diffie-Hellman calculations:
   DH1 = DH(IK_A, SPK_B)
   DH2 = DH(EK_A, IK_B)
   DH3 = DH(EK_A, SPK_B)
   DH4 = DH(EK_A, OPK_B)

3. Shared Secret = KDF(DH1 || DH2 || DH3 || DH4)

4. Root Key and Chain Key derived from Shared Secret
\`\`\`

### 3. Double Ratchet Algorithm

For each message:

\`\`\`
Root Key (RK)
    ├── Chain Key (CK)
    │   └── Message Key (MK) → Encrypts message
    │
    └── New Chain Key → For next message

Every message uses a UNIQUE encryption key!
\`\`\`

**Benefits**:
- If one key is compromised, previous messages stay secure
- If device is compromised, future messages stay secure
- Each message has independent security

### 4. Message Encryption

\`\`\`javascript
// Simplified flow
const messageKey = deriveMessageKey(chainKey)
const ciphertext = AES-GCM(plaintext, messageKey)
const mac = HMAC(ciphertext, macKey)

// Message structure
{
  header: {
    senderRatchetKey,
    previousChainLength,
    messageNumber
  },
  ciphertext: encryptedContent,
  mac: authenticationTag
}
\`\`\`

## Security Properties

### Confidentiality

- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits
- **Unique Keys**: Every message encrypted with unique key
- **Protection**: Protects message content from eavesdroppers

### Integrity

- **Algorithm**: HMAC-SHA256
- **Protection**: Detects any tampering with messages
- **Verification**: Each message authenticated

### Forward Secrecy

- **Mechanism**: DH ratchet with each message exchange
- **Benefit**: Past messages secure even if:
  - Current keys are compromised
  - Device is seized
  - Memory is dumped

### Future Secrecy (Healing)

- **Mechanism**: New DH ratchet periodically
- **Benefit**: Future messages secure after key compromise
- **Healing Time**: Typically 1 round trip (2 messages)

## Implementation Details

### Current Implementation

\`\`\`typescript
// In lib/encryption.ts

1. Key Storage: InMemorySignalProtocolStore
   - Stores identity keys
   - Stores pre-keys
   - Stores session state
   
2. Key Generation:
   - generateIdentityKeyPair()
   - generateSignedPreKey()
   - generatePreKeys()

3. Encryption/Decryption:
   - encryptMessage()
   - decryptMessage()
\`\`\`

### Database Storage

\`\`\`sql
-- Users table stores public keys
CREATE TABLE users (
  identity_key TEXT,        -- Public Identity Key
  signed_pre_key TEXT,      -- Public Signed Pre-Key
  pre_key_signature TEXT    -- Signature
);

-- Messages table stores encrypted content
CREATE TABLE messages (
  encrypted_content TEXT    -- Encrypted message
);
\`\`\`

**Important**: Private keys NEVER leave the device or go to the server!

## Security Considerations

### ✅ What's Secure

1. **Message Content**: Fully encrypted end-to-end
2. **Message Keys**: Unique per message
3. **Forward Secrecy**: Past messages protected
4. **Authentication**: Messages authenticated

### ⚠️ Production Improvements Needed

#### 1. Key Storage

**Current**: In-memory (resets on refresh)
**Production**: Implement persistent secure storage

\`\`\`typescript
// Options:
- IndexedDB with Web Crypto API encryption
- Secure Enclave on iOS
- Android Keystore
- Hardware Security Module (HSM)
\`\`\`

#### 2. Key Backup

Implement secure key backup mechanism:
- Encrypted cloud backup
- Recovery phrases (BIP39)
- Multi-device sync

#### 3. Perfect Forward Secrecy

Implement automatic key rotation:
- Delete old keys after use
- Regular pre-key rotation
- Session cleanup

#### 4. Metadata Protection

Current metadata visible to server:
- Who sends to whom
- Message timestamps
- Message sizes

**Solutions**:
- Use padding to hide message sizes
- Implement mix networks
- Add dummy traffic

## Threat Model

### Protected Against

✅ Passive network eavesdropping
✅ Active man-in-the-middle attacks
✅ Server compromise (message content)
✅ Compromised past session keys
✅ Message tampering
✅ Replay attacks

### NOT Protected Against (Without Additional Work)

❌ Compromised device endpoints
❌ Keyloggers on user devices
❌ Malicious clients
❌ Metadata analysis
❌ Traffic analysis

## Best Practices

### For Development

1. **Never log keys**: Don't console.log() encryption keys
2. **Secure storage**: Use proper key storage in production
3. **Regular updates**: Keep @libsignal/client updated
4. **Audit code**: Regular security audits
5. **Test thoroughly**: Test encryption/decryption flows

### For Production

1. **Key rotation**: Implement automatic key rotation
2. **Secure delete**: Overwrite keys before deletion
3. **Rate limiting**: Prevent brute force attacks
4. **Monitoring**: Monitor for unusual patterns
5. **Incident response**: Plan for key compromise

## Compliance

### GDPR Compliance

- ✅ Data minimization (only encrypted content stored)
- ✅ Right to deletion (messages can be deleted)
- ✅ Data portability (export functionality)
- ✅ Privacy by design (E2E encryption)

### Other Standards

- HIPAA: Suitable with proper implementation
- FISMA: Requires additional controls
- SOC 2: Needs proper audit trail

## Cryptographic Algorithms

### Symmetric Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits
- **Mode**: Galois/Counter Mode (authenticated encryption)

### Key Exchange
- **Algorithm**: Elliptic Curve Diffie-Hellman (ECDH)
- **Curve**: Curve25519
- **Key Size**: 256 bits

### Signatures
- **Algorithm**: Ed25519
- **Key Size**: 256 bits

### Hashing
- **Algorithm**: SHA-256, SHA-512
- **HMAC**: HMAC-SHA256

### Key Derivation
- **Algorithm**: HKDF (HMAC-based KDF)
- **Hash**: SHA-256

## Testing Encryption

### Verify Encryption Works

\`\`\`javascript
// In browser console:
const message = "Hello, World!"
const encrypted = await signalEncryption.encryptMessage(
  recipientAddress, 
  message
)
console.log("Encrypted:", encrypted)

const decrypted = await signalEncryption.decryptMessage(
  senderAddress, 
  encrypted
)
console.log("Decrypted:", decrypted)
// Should match original message
\`\`\`

## Resources

### Signal Protocol Documentation
- [Signal Protocol Overview](https://signal.org/docs/)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)

### Libraries
- [@libsignal/client](https://www.npmjs.com/package/@libsignal/client)
- [Signal Protocol TypeScript](https://github.com/signalapp/libsignal)

### Papers
- "The Double Ratchet Algorithm" by Trevor Perrin & Moxie Marlinspike
- "The X3DH Key Agreement Protocol" by Moxie Marlinspike & Trevor Perrin

## Questions?

**Is this as secure as Signal app?**
The protocol is the same, but production Signal has years of hardening. This is a great foundation but needs additional work for production use.

**Can the server read my messages?**
No! Messages are encrypted on your device and only the recipient can decrypt them.

**What if someone steals my phone?**
Current implementation: Keys stored in memory (lost on refresh)
Production: Implement device-level encryption and PIN/biometric locks

**Can I trust this?**
The encryption library (@libsignal/client) is developed by Signal Foundation. The implementation follows Signal Protocol specifications. However, this is a demo - production apps need additional security hardening.

---

Remember: Security is a process, not a product. Keep learning and improving! 🔒
