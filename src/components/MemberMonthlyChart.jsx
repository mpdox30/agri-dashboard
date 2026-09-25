// src/components/MemberMonthlyChart.jsx
//
// กราฟเส้นรายได้สุทธิรายเดือนของสมาชิกคนเดียว ตลอดช่วงที่เลือกอยู่ — SVG วาดเอง ตาม
// ธรรมเนียมเดียวกับกราฟอื่นในหน้านี้ (ไม่มีแถบฤดูเหมือน SeasonalLineChart เพราะโฟกัสที่
// แนวโน้มรายบุคคล ไม่ใช่ภาพรวมชุมชน)
import './MemberMonthlyChart.css';

const WIDTH = 700;
const HEIGHT = 130;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 22;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

function formatCompact(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/**
 * props:
 *   monthly: { label, netIncome, hasData }[] จาก buildMemberMonthlySeries()
 */
export default function MemberMonthlyChart({ monthly }) {
  const values = monthly.map((m) => m.netIncome);
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values); // รวม 0 ไว้เสมอ เผื่อมีเดือนติดลบจริง จะได้มีเส้นฐาน 0 ให้เทียบ
  const valueRange = maxVal - minVal || 1;

  const stepX = monthly.length > 1 ? CHART_WIDTH / (monthly.length - 1) : 0;

  function xAt(i) {
    return PADDING_LEFT + i * stepX;
  }
  function yAt(value) {
    return PADDING_TOP + CHART_HEIGHT * (1 - (value - minVal) / valueRange);
  }

  const points = monthly.map((m, i) => ({ x: xAt(i), y: yAt(m.netIncome), ...m }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const zeroY = yAt(0);

  return (
    <div className="member-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="member-chart"
        role="img"
        aria-label="กราฟเส้นรายได้สุทธิรายเดือนของสมาชิก"
      >
        {minVal < 0 && (
          <line
            x1={PADDING_LEFT}
            y1={zeroY}
            x2={WIDTH - PADDING_RIGHT}
            y2={zeroY}
            className="member-chart-zero-baseline"
          />
        )}

        <path d={linePath} className="member-chart-line" fill="none" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} className="member-chart-dot" opacity={p.hasData ? 1 : 0.35} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" className="member-chart-value-label">
              {formatCompact(p.netIncome)}
            </text>
            <text x={p.x} y={HEIGHT - 6} textAnchor="middle" className="member-chart-month-label">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="member-chart-hint">จุดจาง = เดือนที่ยังไม่มีข้อมูลของสมาชิกคนนี้</div>
    </div>
  );
}
