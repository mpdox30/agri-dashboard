// src/components/charts/useCrosshair.js
//
// ติดเส้นอ้างอิงแนวตั้งให้กราฟ SVG: ชี้เมาส์ / แตะนิ้ว / กดลูกศรบนคีย์บอร์ด แล้วคืนค่าดัชนีจุดข้อมูลที่ใกล้ที่สุด
// ผู้เรียกใช้เป็นคนวาดเส้นและกล่องข้อความเอง (ดู SvgTooltip) hook นี้จัดการเฉพาะเหตุการณ์และการคำนวณตำแหน่ง
import { useCallback, useMemo, useState } from 'react';

/**
 * @param {number[]} xs  พิกัด x (ในหน่วย viewBox) ของแต่ละจุดข้อมูล เรียงจากซ้ายไปขวา
 * @param {number} viewBoxWidth  ความกว้างของ viewBox
 * @returns {{ active: number|null, bind: object, clear: () => void }}
 *   bind = props ที่ spread ใส่ <svg> (onPointerMove ฯลฯ รวม tabIndex และ onKeyDown)
 */
export default function useCrosshair(xs, viewBoxWidth) {
  const [active, setActive] = useState(null);

  const nearest = useCallback(
    (clientX, svg) => {
      if (!xs.length) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return null;
      const x = ((clientX - rect.left) / rect.width) * viewBoxWidth;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < xs.length; i += 1) {
        const d = Math.abs(xs[i] - x);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    [xs, viewBoxWidth],
  );

  const clear = useCallback(() => setActive(null), []);

  const bind = useMemo(
    () => ({
      tabIndex: 0,
      style: { touchAction: 'pan-y' },
      onPointerMove: (e) => setActive(nearest(e.clientX, e.currentTarget)),
      onPointerDown: (e) => setActive(nearest(e.clientX, e.currentTarget)),
      // เมาส์ออกจากกราฟให้ล้าง แต่บนจอสัมผัสให้ค้างค่าไว้จนแตะที่อื่น จะได้อ่านได้สะดวก
      onPointerLeave: (e) => {
        if (e.pointerType === 'mouse') setActive(null);
      },
      onBlur: () => setActive(null),
      onKeyDown: (e) => {
        if (!xs.length) return;
        if (e.key === 'Escape') {
          setActive(null);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setActive((cur) => (cur === null ? 0 : Math.min(xs.length - 1, cur + 1)));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setActive((cur) => (cur === null ? xs.length - 1 : Math.max(0, cur - 1)));
        }
      },
    }),
    [nearest, xs.length],
  );

  return { active, bind, clear };
}
