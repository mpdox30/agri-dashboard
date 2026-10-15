// src/components/ui/SegmentBar.jsx
//
// แถบสัดส่วนแบ่งเป็นช่วงสี (เช่น ชุมชนที่รายได้เพิ่ม / ลด / ทรงตัว) ความกว้างค่อยๆ ขยายจาก 0
// เมื่อเลื่อนมาเห็น ส่วนตัวเลขและคำอธิบายแต่ละช่วงให้ผู้เรียกใช้วางเองข้างๆ
import useInView from './useInView';
import { useMotionDisabled } from './motion';
import './ui.css';

/**
 * props:
 *   segments: { key, value, tone: 'up' | 'down' | 'flat', label }[]
 */
export default function SegmentBar({ segments, className = '' }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(' ');
  return (
    <div ref={ref} className={`segbar ${className}`.trim()} role="img" aria-label={summary}>
      {total === 0 ? (
        <span className="segbar__part segbar__part--empty" style={{ width: '100%' }} />
      ) : (
        segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`segbar__part segbar__part--${s.tone}`}
              style={{ width: inView ? `${(s.value / total) * 100}%` : '0%' }}
            />
          ))
      )}
    </div>
  );
}
