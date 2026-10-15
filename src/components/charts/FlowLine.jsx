// src/components/charts/FlowLine.jsx
//
// เส้นประขาวบางๆ ที่ไหลไปตามเส้นกราฟหลัก ให้ความรู้สึกว่าข้อมูลกำลังเคลื่อนที่ (แบบเส้นน้ำไหล)
// ปรากฏหลังเส้นหลักวาดเสร็จ เป็นเครื่องประดับล้วนๆ (aria-hidden) ปิดเมื่อลดการเคลื่อนไหวหรือส่งออกรูป
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

export default function FlowLine({ d, delay = 1300 }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  if (motionOff) return null;
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      aria-hidden="true"
      className="flow-line"
      style={{ opacity: inView ? 1 : 0, transition: `opacity 0.8s var(--ease-out) ${delay}ms` }}
    />
  );
}
