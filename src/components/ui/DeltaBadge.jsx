// src/components/ui/DeltaBadge.jsx
//
// ป้ายบอกการเปลี่ยนแปลงเป็นเปอร์เซ็นต์ ใช้โทนกลางๆ (เขียวเมื่อเพิ่ม น้ำตาลแดงอ่อนเมื่อลด
// เทาเมื่อทรงตัว) ไม่ใช้สีเตือนรุนแรง เพราะรายได้รายเดือนของเกษตรกรผันผวนตามฤดูกาลเป็นปกติ
import { classifyDelta } from './deltaClass';
import './ui.css';

/**
 * props:
 *   value: เปอร์เซ็นต์การเปลี่ยนแปลง (เช่น 12.5) หรือ null ถ้าไม่มีข้อมูลเทียบ
 *   suffix: ข้อความต่อท้าย เช่น "จากช่วงก่อน"
 */
export default function DeltaBadge({ value, suffix = '' }) {
  const direction = classifyDelta(value);
  if (!direction) return null;
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '—';
  const word = direction === 'up' ? 'เพิ่มขึ้น' : direction === 'down' ? 'ลดลง' : 'ทรงตัว';
  const amount = Math.abs(value).toFixed(1);
  return (
    <span className={`delta-badge delta-badge--${direction}`}>
      <span aria-hidden="true">
        {arrow} {amount}%
      </span>
      <span className="sr-only">
        {word} {amount}%
      </span>
      {suffix && <span className="delta-badge__suffix"> {suffix}</span>}
    </span>
  );
}
