// src/components/ui/useCountUp.js
//
// ค่าตัวเลขที่ค่อยๆ นับจากค่าที่แสดงอยู่ไปถึงเป้าหมาย (ครั้งแรกนับจาก 0) ด้วยเส้นโค้ง
// ease-out ยกกำลังสี่ ช้าลงเมื่อใกล้ถึง เพื่อให้ตาจับตัวเลขสุดท้ายได้ทัน
// ถ้าปิดการเคลื่อนไหว (ดู motion.js) จะคืนค่าเป้าหมายทันทีโดยไม่มีสถานะภายใน
import { useEffect, useRef, useState } from 'react';
import { useMotionDisabled } from './motion';

export default function useCountUp(target, { duration = 1000, start = true } = {}) {
  const motionOff = useMotionDisabled();
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  const canAnimate = start && !motionOff && Number.isFinite(target);

  useEffect(() => {
    if (!canAnimate) return undefined;
    const from = fromRef.current;
    const startedAt = performance.now();
    let frame = 0;
    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const value = progress >= 1 ? target : from + (target - from) * (1 - Math.pow(1 - progress, 4));
      fromRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canAnimate, target, duration]);

  if (motionOff || !Number.isFinite(target)) return target;
  return shown;
}
