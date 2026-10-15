// src/components/useMyCommunity.js
//
// จำ "ชุมชนของฉัน" และสถานะตอนเข้ามาครั้งก่อนไว้ในเบราว์เซอร์ของผู้ชม (localStorage)
// อ่านค่าตอนเริ่มครั้งเดียว และเขียนภาพถ่ายสถานะใหม่เมื่อข้อมูลโหลดเสร็จ เพื่อใช้เทียบในครั้งถัดไป
import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson, removeKey } from '../utils/safeStorage';

const MY_KEY = 'agriDashboard.myCommunity.v1';
const VISIT_KEY = 'agriDashboard.lastVisit.v1';
const MIN_SNAPSHOT_GAP_MS = 6 * 60 * 60 * 1000;

export default function useMyCommunity(currentSnapshot) {
  const [myKey, setMyKeyState] = useState(() => {
    const stored = readJson(MY_KEY);
    return stored && typeof stored.key === 'string' ? stored.key : null;
  });
  // ภาพถ่ายของครั้งก่อน อ่านครั้งเดียวตอนเริ่ม ไม่เปลี่ยนตลอดการเข้าชมรอบนี้
  const [previousVisit] = useState(() => readJson(VISIT_KEY));

  const setMyKey = useCallback((key) => {
    setMyKeyState(key);
    if (key) writeJson(MY_KEY, { key });
    else removeKey(MY_KEY);
  }, []);

  // บันทึกภาพถ่ายใหม่เฉพาะเมื่อครั้งก่อนห่างพอ (6 ชั่วโมง) ไม่งั้นการรีเฟรชหน้าซ้ำๆ จะทำให้ข้อความ
  // "ตั้งแต่ครั้งก่อน" หายไปทั้งที่ผู้ใช้ยังไม่ได้เห็นข้อมูลใหม่จริง
  useEffect(() => {
    if (!currentSnapshot) return;
    if (previousVisit && previousVisit.at && currentSnapshot.at - previousVisit.at < MIN_SNAPSHOT_GAP_MS) return;
    writeJson(VISIT_KEY, currentSnapshot);
  }, [currentSnapshot, previousVisit]);

  return { myKey, setMyKey, previousVisit };
}
