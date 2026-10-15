// src/components/charts/WipeReveal.jsx
//
// เปิดเผยกราฟจากซ้ายไปขวาด้วย clipPath (ใช้กับกราฟเส้นประหลายเส้นที่ DrawInPath ใช้ไม่ได้ เพราะลวดลายเส้นประจะหาย)
// ปิดแอนิเมชันเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว หรือกำลังส่งออกรูป/PDF
import { useId } from 'react';
import useInView from '../ui/useInView';
import { useMotionDisabled } from '../ui/motion';
import './charts.css';

export default function WipeReveal({ width, height, duration = 1100, children }) {
  const rawId = useId();
  const clipId = `wipe-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  if (motionOff) return <g>{children}</g>;
  return (
    <>
      <clipPath id={clipId}>
        <rect
          ref={ref}
          x="0"
          y="0"
          width={width}
          height={height}
          className="wipe-rect"
          style={{
            transform: inView ? 'scaleX(1)' : 'scaleX(0)',
            transition: `transform ${duration}ms var(--ease-out)`,
          }}
        />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </>
  );
}
