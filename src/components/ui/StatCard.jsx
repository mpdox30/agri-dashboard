// src/components/ui/StatCard.jsx
//
// การ์ดตัวเลขสำคัญ: ป้าย ตัวเลขใหญ่ที่นับขึ้น หน่วย ป้ายเปลี่ยนแปลง และพื้นที่เสริมด้านล่าง
// (เช่น เส้นแนวโน้มเล็ก) ตัวเลขแสดงเต็มพร้อมจุลภาคตามที่ตกลงกัน
import Card from './Card';
import CountUp from './CountUp';
import DeltaBadge from './DeltaBadge';
import Reveal from './Reveal';
import './ui.css';

/**
 * props:
 *   label: ข้อความป้ายกำกับ
 *   value: เลขเป้าหมาย (number) หรือ null ถ้ายังไม่มีข้อมูล
 *   format: (n) => string  วิธีแสดงตัวเลข (ค่าเริ่มต้น = เลขเต็มพร้อมจุลภาค)
 *   unit: หน่วย เช่น "บาท"
 *   delta: เปอร์เซ็นต์การเปลี่ยนแปลง หรือ null
 *   deltaSuffix: เช่น "จากช่วงก่อน"
 *   note: ข้อความอธิบายสั้นๆ ใต้ตัวเลข (ใช้เมื่อไม่มี delta)
 *   delay: หน่วงการผุดขึ้นเป็นมิลลิวินาที ไว้ไล่ลำดับหลายการ์ดให้ทยอยขึ้น
 *   icon: ไอคอนมุมขวาบน (ดู kpiIcons.jsx) ไม่ใส่ก็ได้
 *   color: 'green' | 'terracotta' | 'sage' | 'ink' โทนของตัวเลขและแสงเรืองมุมการ์ด (ค่าเริ่มต้น green)
 */
export default function StatCard({ label, value, format, unit, delta = null, deltaSuffix, note, delay = 0, tone, icon, color = 'green', children, className = '' }) {
  return (
    <Reveal delay={delay} className={`stat-card stat-card--${color} ${className}`.trim()}>
      <Card tone={tone}>
        <div className="stat-card__top">
          <div className="stat-card__label">{label}</div>
          {icon && <span className="stat-card__icon">{icon}</span>}
        </div>
        <div className="stat-card__value">
          {value === null || value === undefined ? (
            '—'
          ) : (
            <CountUp value={value} format={format} />
          )}
        </div>
        {unit && <div className="stat-card__unit">{unit}</div>}
        {delta !== null && <DeltaBadge value={delta} suffix={deltaSuffix} />}
        {delta === null && note && <div className="stat-card__note">{note}</div>}
        {children}
      </Card>
    </Reveal>
  );
}
