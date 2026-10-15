// src/components/ui/motion.js
//
// สถานะ "ปิดการเคลื่อนไหว" ศูนย์กลางของทั้งเว็บ — แอนิเมชันทุกตัว (นับเลขขึ้น, เปิดเนื้อหา
// เมื่อเลื่อนถึง, วาดเส้นกราฟเข้า) ต้องถามจากที่นี่ที่เดียว เพื่อให้พฤติกรรมตรงกันทั้งหมด
//
// ปิดแอนิเมชันเมื่อ 1) ผู้ใช้ตั้งค่า prefers-reduced-motion ในระบบ หรือ 2) กำลังส่งออกไฟล์
// (พิมพ์/PDF/ภาพ) ซึ่งต้องได้ค่าสุดท้ายครบทันที ไม่ใช่ตัวเลขที่ยังนับไม่ถึงหรือกราฟที่ยังวาดไม่เสร็จ
// — โค้ดส่วนส่งออกเรียก setExporting(true) ก่อนเริ่ม และ setExporting(false) เมื่อเสร็จ
import { useSyncExternalStore } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

let exporting = false;
const exportingListeners = new Set();

export function setExporting(next) {
  if (exporting === next) return;
  exporting = next;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('is-exporting', next);
  }
  exportingListeners.forEach((listener) => listener());
}

function subscribeExporting(callback) {
  exportingListeners.add(callback);
  return () => exportingListeners.delete(callback);
}

function getExporting() {
  return exporting;
}

export function useExporting() {
  return useSyncExternalStore(subscribeExporting, getExporting, () => false);
}

function subscribeReduced(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getReduced() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCED_QUERY).matches;
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, getReduced, () => false);
}

/** true = ห้ามเล่นแอนิเมชัน ให้แสดงค่าสุดท้ายทันที */
export function useMotionDisabled() {
  const reduced = useReducedMotion();
  const isExporting = useExporting();
  return reduced || isExporting;
}
