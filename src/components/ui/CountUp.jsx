// src/components/ui/CountUp.jsx
//
// ตัวเลขที่นับขึ้นเมื่อเลื่อนมาเห็น ส่วนที่นับถูกซ่อนจากโปรแกรมอ่านหน้าจอ (aria-hidden)
// และมีค่าสุดท้ายแบบข้อความธรรมดาให้อ่านแทน จะได้ไม่อ่านเลขที่กำลังวิ่งทีละหลัก
import useInView from './useInView';
import useCountUp from './useCountUp';
import './ui.css';

function defaultFormat(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/**
 * props:
 *   value: เลขเป้าหมาย
 *   format: (n) => string  ต้องแสดงตัวเลขเต็มพร้อมจุลภาค ห้ามย่อเป็น "พ." หรือ "ล."
 *   duration: มิลลิวินาที
 */
export default function CountUp({ value, format = defaultFormat, duration = 1000, className = '' }) {
  const [ref, inView] = useInView();
  const current = useCountUp(value, { duration, start: inView });
  return (
    <span ref={ref} className={`count-up tabular ${className}`.trim()}>
      <span aria-hidden="true">{format(current)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
