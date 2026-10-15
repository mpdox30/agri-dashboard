// src/components/ui/useInView.js
//
// บอกว่าองค์ประกอบเลื่อนเข้ามาในจอแล้วหรือยัง (ครั้งแรกครั้งเดียว) ใช้กับแอนิเมชันที่ควร
// เริ่มเมื่อผู้ใช้เห็นจริง เช่น นับตัวเลขขึ้น วาดเส้นกราฟ — ไม่ใช่เล่นไปตั้งแต่โหลดหน้า
// ซึ่งผู้ใช้จะไม่ทันเห็น
import { useEffect, useRef, useState } from 'react';

export default function useInView({ rootMargin = '0px 0px -8% 0px', disabled = false } = {}) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  // เบราว์เซอร์เก่าที่ไม่มี IntersectionObserver ให้ถือว่าเห็นแล้ว จะได้ไม่ซ่อนเนื้อหาไว้ตลอดไป
  const unsupported = typeof IntersectionObserver === 'undefined';
  const forced = disabled || unsupported;

  useEffect(() => {
    const el = ref.current;
    if (forced || !el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [forced, rootMargin]);

  return [ref, forced || seen];
}
