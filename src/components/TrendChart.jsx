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
  const maxValue = knownValues.length > 0 ? Math.max(...knownValues, 1) : 1;

  return (
    <div className="trend-card">
      <div className="trend-chart">
        {months.map((m) => {
          const hasData = m.netIncome !== null;
          const heightPct = hasData ? Math.max((m.netIncome / maxValue) * 100, 4) : 3;
          return (
            <div className="trend-bar-col" key={m.label}>
              <div className="trend-bar-val">
                {hasData ? (m.netIncome / 1_000_000).toFixed(2) : '—'}
              </div>
              <div
                className={hasData ? 'trend-bar' : 'trend-bar trend-bar--dim'}
                style={{ height: `${heightPct}%` }}
              />
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
          <span className="trend-legend__dot trend-legend__dot--unknown" />
          ยังไม่มีข้อมูล / ยังไม่ถึงเวลา
        </span>
      </div>
    </div>
  );
}
