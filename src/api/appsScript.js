// src/api/appsScript.js
//
// API client เดียวสำหรับเรียก Apps Script Web App ที่ deploy ไว้แล้ว
// ทุกฟังก์ชันคืน Promise ที่ resolve เป็นข้อมูลตรง ๆ (ไม่ใช่ Response object)
// และ throw Error ถ้า ok !== true เพื่อให้ใช้ try/catch หรือ .catch() ได้ตามปกติ
//
// *** ต้องแก้ค่านี้ก่อนใช้งานจริง ***
// แก้เป็น URL ที่ได้จาก Deploy > New deployment > Web app (ลงท้ายด้วย /exec)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRknYQEUa5f3LXUfiA1hob_bZZevXgx6dkdFLibpodI7s64PkcXEQZUH9gTSnxaB0M/exec';

/**
 * ป้องกันไว้อีกชั้น เผื่อ Google Sheets แปลงคอลัมน์ "month" เป็นชนิดวันที่อัตโนมัติ
 * (เกิดได้ทั้งจากตอนอัปโหลดข้อมูลครั้งแรก หรือถ้าคอลัมน์ไม่ได้ตั้ง format เป็น Plain
 * text ไว้) ถ้าเกิดเหตุนี้ ค่าที่ได้จะกลายเป็น ISO datetime เช่น
 * "2026-04-01T00:00:00.000Z" แทนที่จะเป็น "2026-04" ตรง ๆ ซึ่งจะทำให้การเทียบ string
 * แบบตรงเป๊ะ (เช่น หาเดือนที่ข้อมูลครบ) พังหมด ฟังก์ชันนี้ดึงแค่ส่วน YYYY-MM ออกมา
 * เสมอ ไม่ว่าค่าที่ได้จะเป็นรูปแบบไหนก็ตาม
 *
 * หมายเหตุ: นี่เป็นการป้องกันชั้นที่สองเท่านั้น จุดที่ควรแก้จริง ๆ คือฝั่ง Apps Script
 * (Code.gs's readSheetAsObjects) เพราะปัญหาเดียวกันนี้ทำให้ตรรกะฝั่ง backend เอง
 * (เช็คล็อกเดือน, หาเดือนก่อนหน้าสำหรับเทียบความผิดปกติ) พังไปด้วย ซึ่งโค้ดฝั่งนี้
 * แก้ไม่ได้เพราะเกิดขึ้นก่อนข้อมูลจะถูกส่งมาถึง React เสียอีก
 */
function normalizeMonthValue(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : value;
  }
  return value;
}

/** เดินดูทุก object/array แบบลงลึก แก้ไขทุกฟิลด์ชื่อ "month" ที่เจอให้เป็น YYYY-MM เสมอ */
function deepNormalizeMonthFields(value) {
  if (Array.isArray(value)) {
    value.forEach(deepNormalizeMonthFields);
    return value;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      if (key === 'month') {
        value[key] = normalizeMonthValue(value[key]);
      } else {
        deepNormalizeMonthFields(value[key]);
      }
    });
  }
  return value;
}

/**
 * เรียก doGet ด้วย action + พารามิเตอร์เพิ่มเติม (object ธรรมดา)
 * ตัวอย่าง: callGet('monthly_summary', { community_key: 'ป่าภูถ้ำ' })
 */
async function callGet(action, params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`เรียก API ไม่สำเร็จ (HTTP ${response.status})`);
  }
  const body = await response.json();
  if (!body.ok) {
    throw new Error(body.error || 'เกิดข้อผิดพลาดที่ไม่รู้สาเหตุจาก API');
  }
  return deepNormalizeMonthFields(body.data);
}

/**
 * เรียก doPost ด้วย action + payload (object) ส่งเป็น JSON body
 * ตัวอย่าง: callPost('submit_entry', { password, community_key, month, members })
 */
async function callPost(action, payload = {}) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // ใช้ text/plain ตั้งใจ เพื่อเลี่ยง CORS preflight (OPTIONS) ที่ Apps Script
    // เว็บแอปไม่รองรับ — Apps Script ยัง parse เป็น JSON ได้ปกติฝั่ง backend
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!response.ok) {
    throw new Error(`เรียก API ไม่สำเร็จ (HTTP ${response.status})`);
  }
  const body = await response.json();
  if (!body.ok) {
    const err = new Error(body.error || 'เกิดข้อผิดพลาดที่ไม่รู้สาเหตุจาก API');
    err.locked = body.locked || false;
    throw err;
  }
  return body;
}

// --- ฟังก์ชันที่หน้าเว็บเรียกใช้จริง (wrap callGet/callPost ให้ใช้ง่ายขึ้น) ---

export function getCommunities() {
  return callGet('communities');
}

export function getMonthlyRecords(communityKey) {
  return callGet('monthly_records', { community_key: communityKey });
}

export function getMonthlySummary(communityKey) {
  return callGet('monthly_summary', { community_key: communityKey });
}

export function checkLock(communityKey, month) {
  return callGet('check_lock', { community_key: communityKey, month });
}

export function getPendingReview(password) {
  return callGet('pending_review', { password });
}

export function submitEntry({ password, communityKey, month, submittedBy, members }) {
  return callPost('submit_entry', {
    password,
    community_key: communityKey,
    month,
    submitted_by: submittedBy,
    members,
  });
}

export function approveSubmission({ password, submissionId, reviewerNote }) {
  return callPost('approve_submission', {
    password,
    submission_id: submissionId,
    reviewer_note: reviewerNote,
  });
}

export function rejectSubmission({ password, submissionId, reviewerNote }) {
  return callPost('reject_submission', {
    password,
    submission_id: submissionId,
    reviewer_note: reviewerNote,
  });
}
