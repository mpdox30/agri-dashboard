// src/components/charts/AreaFill.jsx
//
// พื้นที่ไล่สีใต้เส้นกราฟ (จางลงจากเส้นไปหาแกนล่าง) ค่อยๆ ปรากฏหลังเส้นถูกวาดเสร็จ
// ใช้คู่กับ DrawInPath: ส่งพิกัดจุดเดียวกับเส้นเข้ามา แล้วคอมโพเนนต์ปิดรูปร่างลงมาที่เส้นฐานเอง
// เป็นเครื่องประดับล้วนๆ (aria-hidden) ข้อมูลจริงอ่านได้จากเส้น จุด และตารางอยู่แล้ว
import { useId } from 'react';
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

/**
 * props:
 *   points: { x: number, y: number }[]
 *   baselineY: พิกัด y ของเส้นฐานที่พื้นที่ปิดลงไป
 *   color: สีพื้นที่ (ค่าเริ่มต้นเขียวอ่อน)
 *   delay: หน่วงก่อนเริ่มจาง (ms) ให้ตามหลังเส้นที่กำลังถูกวาด
 */
export default function AreaFill({ points, baselineY, color = 'var(--green-soft)', delay = 700 }) {
  const gid = useId();
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  if (!points || points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const d =
    `M ${first.x} ${baselineY} ` +
    points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${last.x} ${baselineY} Z`;

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        ref={ref}
        d={d}
        fill={`url(#${gid})`}
        stroke="none"
        className="area-fill"
        style={motionOff ? undefined : { opacity: inView ? 1 : 0, transition: `opacity 0.9s var(--ease-out) ${delay}ms` }}
      />
    </g>
  );
}
