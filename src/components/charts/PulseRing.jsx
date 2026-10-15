// src/components/charts/PulseRing.jsx
//
// วงคลื่นที่แผ่ออกจากจุดสำคัญ (เช่น จุดสูงสุด จุดล่าสุด) เรียกสายตาไปที่จุดนั้นเบาๆ
// ปิดเมื่อลดการเคลื่อนไหวหรือส่งออกรูป (ไม่แสดงเลย เพราะเป็นเครื่องประดับ)
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

export default function PulseRing({ cx, cy, color = 'var(--terracotta)', delay = 1400 }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  if (motionOff) return null;
  return (
    <circle
      ref={ref}
      cx={cx}
      cy={cy}
      r="4"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      aria-hidden="true"
      className="pulse-ring"
      style={{ animationDelay: `${delay}ms`, visibility: inView ? 'visible' : 'hidden' }}
    />
  );
}
