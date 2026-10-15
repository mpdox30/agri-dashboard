// src/components/ui/deltaClass.js
//
// จัดกลุ่มการเปลี่ยนแปลงเป็น up / down / flat (แยกไฟล์จากคอมโพเนนต์เพื่อให้ react-refresh ทำงานถูก)

// เปลี่ยนแปลงไม่ถึงค่านี้ (เป็น %) ถือว่าทรงตัว ให้ตรงกับที่แสดงทศนิยม 1 ตำแหน่ง
export const FLAT_THRESHOLD = 0.05;

export function classifyDelta(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (Math.abs(value) < FLAT_THRESHOLD) return 'flat';
  return value > 0 ? 'up' : 'down';
}
