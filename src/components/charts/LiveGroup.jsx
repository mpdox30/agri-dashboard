// src/components/charts/LiveGroup.jsx
//
// กลุ่ม SVG ที่เริ่ม "มีชีวิต" เมื่อเลื่อนมาเห็น: จุดข้อมูล (circle) ข้างในผุดขึ้นทีละจุดตามลำดับ --i
// ที่ผู้เรียกใส่ให้ (ดูกฎ .chart-dots ใน charts.css) ถ้าปิดการเคลื่อนไหวหรือกำลังส่งออกจะแสดงครบทันที
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

export default function LiveGroup({ children, className = '' }) {
  const motionOff = useMotionDisabled();
  const [ref, live] = useInView({ disabled: motionOff });
  return (
    <g ref={ref} className={`chart-dots ${live ? 'is-live' : ''} ${className}`.trim()}>
      {children}
    </g>
  );
}
