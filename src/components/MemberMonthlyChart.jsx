// src/components/MemberMonthlyChart.jsx
//
// กราฟเส้นรายได้สุทธิรายเดือนของสมาชิกคนเดียว ตลอดช่วงที่เลือกอยู่ — SVG วาดเอง ตาม
// ธรรมเนียมเดียวกับกราฟอื่นในหน้านี้ (ไม่มีแถบฤดูเหมือน SeasonalLineChart เพราะโฟกัสที่
// แนวโน้มรายบุคคล ไม่ใช่ภาพรวมชุมชน)
import useCrosshair from './charts/useCrosshair';
import SvgTooltip from './charts/SvgTooltip';
import DrawInPath from './charts/DrawInPath';
import DataTableToggle from './charts/DataTableToggle';
import './charts/charts.css';
import './MemberMonthlyChart.css';

const WIDTH = 700;
const HEIGHT = 130;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 22;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const TABLE_COLUMNS = [
  { key: 'month', label: 'เดือน' },
  { key: 'net', label: 'รายได้สุทธิ (บาท)', align: 'right' },
];

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
  const xs = points.map((p) => p.x);
  const { active, bind } = useCrosshair(xs, WIDTH);

  // ตัวเลขกำกับเฉพาะจุดสูงสุดและจุดล่าสุดที่มีข้อมูล ที่เหลืออ่านจากกล่องค่าหรือตาราง
  const dataIndexes = points.map((p, i) => (p.hasData ? i : -1)).filter((i) => i >= 0);
  const peakIndex = dataIndexes.length ? dataIndexes.reduce((a, b) => (values[b] > values[a] ? b : a)) : -1;
  const lastIndex = dataIndexes.length ? dataIndexes[dataIndexes.length - 1] : -1;
  const labelIndexes = new Set([peakIndex, lastIndex]);
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const zeroY = yAt(0);

  return (
    <div className="member-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="member-chart chart-focus-ring"
        role="img"
        aria-label="กราฟเส้นรายได้สุทธิรายเดือนของสมาชิก ใช้ปุ่มลูกศรซ้ายขวาเพื่ออ่านค่าแต่ละเดือน หรือเปิดดูเป็นตารางด้านล่าง"
        {...bind}
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

        <DrawInPath d={linePath} className="member-chart-line" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={active === i ? 5.5 : 4}
              className="member-chart-dot"
              opacity={p.hasData ? 1 : 0.35}
            />
            {labelIndexes.has(i) && active === null && (
              <text x={p.x} y={p.y - 8} textAnchor="middle" className="member-chart-value-label">
                {formatCompact(p.netIncome)}
              </text>
            )}
            <text x={p.x} y={HEIGHT - 6} textAnchor="middle" className="member-chart-month-label">
              {p.label}
            </text>
          </g>
        ))}

        {active !== null && (
          <>
            <line x1={xs[active]} x2={xs[active]} y1={PADDING_TOP - 4} y2={HEIGHT - PADDING_BOTTOM} className="chart-crosshair-line" />
            <SvgTooltip
              x={xs[active]}
              y={points[active].y}
              title={points[active].label}
              lines={[
                {
                  label: 'รายได้สุทธิ',
                  value: points[active].hasData ? `${formatCompact(points[active].netIncome)} บาท` : 'ยังไม่มีข้อมูล',
                  color: 'var(--green-soft)',
                },
              ]}
              viewBoxWidth={WIDTH}
            />
          </>
        )}
      </svg>
      <div className="member-chart-hint">จุดจาง = เดือนที่ยังไม่มีข้อมูลของสมาชิกคนนี้ · ชี้หรือแตะที่กราฟเพื่อดูค่าแต่ละเดือน</div>
      <DataTableToggle
        columns={TABLE_COLUMNS}
        rows={monthly.map((m) => ({ key: m.label, month: m.label, net: m.hasData ? formatCompact(m.netIncome) : null }))}
        caption="รายได้สุทธิรายเดือนของสมาชิก หน่วยบาท"
      />
    </div>
  );
}
