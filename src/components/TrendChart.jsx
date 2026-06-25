// src/components/TrendChart.jsx
import './TrendChart.css';

/**
 * props:
 *   months: { label: string, netIncome: number | null }[]
 *     netIncome === null หมายถึง "ยังไม่ถึงเวลา/ยังไม่มีข้อมูลกรอกเข้ามา" (แท่งสีเทา)
 *     ไม่ใช่ค่า 0 จริง — แยกความหมายตรงนี้ตั้งใจ เพื่อไม่ให้ดูเหมือนรายได้ลดลงจริง
 *     เมื่อจริง ๆ แล้วเป็นเพราะเดือนนั้นยังไม่มีคนกรอกข้อมูล
 *
 * หมายเหตุ: คอมโพเนนต์นี้แสดงแค่ตัวกราฟ ไม่มีหัวข้อ/คำอธิบายในตัวเอง — parent
 * (เช่น Homepage.jsx) เป็นคนกำหนดหัวข้อของ section เพื่อเลี่ยงหัวข้อซ้ำกัน
 */
export default function TrendChart({ months }) {
  const knownValues = months.filter((m) => m.netIncome !== null).map((m) => m.netIncome);
  // ใช้ค่าสมบูรณ์สูงสุดเป็นตัวหารสเกล เพื่อให้ค่าติดลบเล็กๆ ไม่ถูกดันให้แถบสูงผิดปกติ
  const maxAbsValue =
    knownValues.length > 0 ? Math.max(...knownValues.map((v) => Math.abs(v)), 1) : 1;
  // ขั้นต่ำความสูงแท่งแค่พอให้มองเห็นเป็นเส้นบางๆ — ไม่บังคับสูงจนค่าใกล้ 0 ดูเหมือนมีรายได้มาก
  // การแยก "มีข้อมูล" vs "ยังไม่มีข้อมูล" ใช้สี (เขียว/เทา) เป็นตัวบอกอยู่แล้ว ไม่ต้องพึ่งความสูง
  const MIN_VISIBLE_PCT = 1.5;

  return (
    <div className="trend-card">
      <div className="trend-chart">
        {months.map((m) => {
          const hasData = m.netIncome !== null;
          const isNegative = hasData && m.netIncome < 0;
          const rawPct = hasData ? (Math.abs(m.netIncome) / maxAbsValue) * 100 : 0;
          const heightPct = hasData ? Math.max(rawPct, MIN_VISIBLE_PCT) : 1.2;
          let barClass = 'trend-bar trend-bar--dim';
          if (hasData) barClass = isNegative ? 'trend-bar trend-bar--negative' : 'trend-bar';
          return (
            <div className="trend-bar-col" key={m.label}>
              <div className="trend-bar-val">
                {hasData ? (m.netIncome / 1_000_000).toFixed(2) : '—'}
              </div>
              <div className={barClass} style={{ height: `${heightPct}%` }} />
              <div className="trend-bar-label">{m.label}</div>
            </div>
          );
        })}
      </div>
      <div className="trend-legend">
        <span>
          <span className="trend-legend__dot trend-legend__dot--known" />
          มีข้อมูลกรอกแล้ว
        </span>
        <span>
          <span className="trend-legend__dot trend-legend__dot--negative" />
          รายได้สุทธิติดลบ
        </span>
        <span>
          <span className="trend-legend__dot trend-legend__dot--unknown" />
          ยังไม่มีข้อมูล / ยังไม่ถึงเวลา
        </span>
      </div>
    </div>
  );
}
