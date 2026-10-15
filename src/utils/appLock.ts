interface StoredPin {
  salt: string;
  hash: string;
}

const PIN_KEY_PREFIX = 'mrbiller.app-pin.';
const PIN_RECOVERY_KEY_PREFIX = 'mrbiller.app-pin-recovery.';
const PIN_HASH_ITERATIONS = 150_000;

function pinKey(userId: string) {
  return `${PIN_KEY_PREFIX}${userId}`;
}

function recoveryKey(userId: string) {
  return `${PIN_RECOVERY_KEY_PREFIX}${userId}`;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hashPin(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: PIN_HASH_ITERATIONS,
    hash: 'SHA-256',
  }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export function hasStoredAppPin(userId: string) {
  return Boolean(localStorage.getItem(pinKey(userId)));
}

export function clearStoredAppPin(userId: string) {
  localStorage.removeItem(pinKey(userId));
}

export function consumePinRecoveryRequest(userId: string) {
  const key = recoveryKey(userId);
  const requested = localStorage.getItem(key) === '1';
  localStorage.removeItem(key);
  return requested;
}

export async function saveStoredAppPin(userId: string, pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: StoredPin = { salt: toBase64(salt), hash: await hashPin(pin, salt) };
  localStorage.setItem(pinKey(userId), JSON.stringify(record));
}

export async function verifyStoredAppPin(userId: string, pin: string) {
  const value = localStorage.getItem(pinKey(userId));
  if (!value) return false;

  try {
    const record = JSON.parse(value) as StoredPin;
    if (!record.salt || !record.hash) return false;
    const actual = await hashPin(pin, fromBase64(record.salt));
    if (actual.length !== record.hash.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) {
      difference |= actual.charCodeAt(index) ^ record.hash.charCodeAt(index);
    }
    return difference === 0;
  } catch {
    return false;
  }
}

export function requestPinRecovery(userId: string) {
  localStorage.setItem(recoveryKey(userId), '1');
}
