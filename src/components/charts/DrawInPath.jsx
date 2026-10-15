// src/components/charts/DrawInPath.jsx
//
// เส้นกราฟที่ค่อยๆ ถูกวาดจากซ้ายไปขวาเมื่อเลื่อนมาเห็น ใช้ pathLength=1 เพื่อไม่ต้องวัดความยาวเส้นจริง
// เมื่อผู้ใช้ปิดแอนิเมชัน หรือกำลังส่งออกรูป/PDF จะแสดงเส้นเต็มทันที
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

export default function DrawInPath({ d, stroke, strokeWidth = 2, duration = 1200, delay = 0, className = '', ...rest }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  const style = motionOff
    ? undefined
    : {
        strokeDasharray: 1,
        strokeDashoffset: inView ? 0 : 1,
        transition: `stroke-dashoffset ${duration}ms var(--ease-out) ${delay}ms`,
      };
  return (
    <path
      ref={ref}
      d={d}
      pathLength={1}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`draw-in ${className}`.trim()}
      style={style}
      {...rest}
    />
  );
}
