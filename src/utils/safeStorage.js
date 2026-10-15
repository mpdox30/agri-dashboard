// src/utils/safeStorage.js
//
// ครอบ localStorage ด้วย try/catch: โหมดส่วนตัว การบล็อกคุกกี้ หรือพื้นที่เต็ม ทำให้ localStorage โยน error ได้
// ถ้าอ่านเขียนไม่ได้ เว็บต้องยังทำงานปกติ แค่จำค่าไม่ได้

export function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ไม่ต้องทำอะไร
  }
}
