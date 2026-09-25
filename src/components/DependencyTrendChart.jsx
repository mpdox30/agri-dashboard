// src/components/DependencyTrendChart.jsx
//
// กราฟแท่งซ้อน (stacked bar) แสดงสัดส่วนแหล่งที่มาของรายได้รายเดือน — ขาย / แบ่งปัน /
// ผลิตเอง / รับฟรี-อื่นๆ — SVG วาดเอง ตามธรรมเนียมเดียวกับกราฟอื่นในหน้านี้
import './DependencyTrendChart.css';

const WIDTH = 700;
const HEIGHT = 170;
const PADDING_LEFT = 8;
const PADDING_RIGHT = 8;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 24;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const BAR_GAP = 4;

const SEGMENTS = [
  { key: 'salePct', className: 'seg-sale', label: 'ขาย' },
  { key: 'sharingPct', className: 'seg-sharing', label: 'แบ่งปัน' },
  { key: 'selfProducedPct', className: 'seg-self', label: 'ผลิตเอง' },
  { key: 'freeOtherPct', className: 'seg-free', label: 'รับฟรี/อื่นๆ' },
];

/**
 * props:
 *   monthly: { label, hasData, salePct, sharingPct, selfProducedPct, freeOtherPct }[]
 *     จาก buildDependencyTrend()
 */
export default function DependencyTrendChart({ monthly }) {
  const n = monthly.length;
  const barWidth = n > 0 ? CHART_WIDTH / n - BAR_GAP : 0;

  function xAt(i) {
    return PADDING_LEFT + i * (CHART_WIDTH / n);
  }

  return (
    <div className="dep-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="dep-chart"
        role="img"
        aria-label="กราฟแท่งซ้อนสัดส่วนแหล่งที่มาของรายได้รายเดือน"
      >
        {monthly.map((m, i) => {
          const x = xAt(i);
          if (!m.hasData) {
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={PADDING_TOP}
                  width={Math.max(barWidth, 0)}
                  height={CHART_HEIGHT}
                  className="dep-bar-empty"
                />
                <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" className="dep-month-label">
                  {m.label}
                </text>
              </g>
            );
          }
          let cursorY = PADDING_TOP + CHART_HEIGHT;
          return (
            <g key={i}>
              {SEGMENTS.map((seg) => {
                const value = m[seg.key] || 0;
                const segHeight = (value / 100) * CHART_HEIGHT;
                cursorY -= segHeight;
                return (
                  <rect
                    key={seg.key}
                    x={x}
                    y={cursorY}
                    width={Math.max(barWidth, 0)}
                    height={segHeight}
                    className={seg.className}
                  />
                );
              })}
              <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" className="dep-month-label">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="dep-chart-legend">
        {SEGMENTS.map((seg) => (
          <span className="legend-item" key={seg.key}>
            <span className={`legend-swatch ${seg.className}`} /> {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
