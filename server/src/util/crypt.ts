import Crypto from 'crypto';

const algorithm = "aes-256-gcm";
const authTagLength = 16;

/**
 * Full disclaimer:
 * I do not have deep encryption experience, and all of
 * the security folk don't understand that they need to
 * bring things into layman's terms. This is a working
 * encryption/decryption algorithm that appears to
 * work reliably.
 * Thanks for not making an easy to use interface.
 */

export const KeyGen = () =>
    Crypto.randomBytes(32);


export const Encrypt = (text: string, key: Buffer) => {
    // iv stands for "initialization vector"
    const iv = Crypto.randomBytes(12);
    const cipher = Crypto.createCipheriv(algorithm, key, iv, { authTagLength });

    const encryptedBuffer = Buffer.concat([
        cipher.update(Buffer.from(text)),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    let bufferLength = Buffer.alloc(1);
    bufferLength.writeUInt8(iv.length, 0);

    return Buffer.concat([bufferLength, iv, authTag, encryptedBuffer]).toString('hex');
};

export const Decrypt = (encoded: string, key: Buffer) => {
    const dataBuffer = Buffer.from(encoded, 'hex');
    const ivSize = dataBuffer.readUInt8(0);
    const iv = dataBuffer.subarray(1, ivSize + 1);

    // The authTag is by default 16 bytes in AES-GCM
    const authTag = dataBuffer.subarray(ivSize + 1, ivSize + authTagLength + 1);
    const decipher = Crypto.createDecipheriv(algorithm, key, iv, { authTagLength });
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(dataBuffer.subarray(ivSize + 17)),
        decipher.final()
    ]).toString();
};
