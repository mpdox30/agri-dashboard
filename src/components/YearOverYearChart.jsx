// src/components/YearOverYearChart.jsx
//
// กราฟเส้นซ้อนหลายปี เทียบรายได้สุทธิรายเดือน ปีที่เลือกอยู่กับปีย้อนหลังหลายปี (ผู้ใช้
// เลือกได้ว่าจะโชว์ปีไหนบ้างผ่าน toggle chip ใน AnalyticsTab.jsx — component นี้แค่วาด
// series ที่ได้รับมา ไม่รู้เรื่องการเลือกเอง) — SVG วาดเอง ตามธรรมเนียมเดียวกับ
// SeasonalLineChart.jsx
import './YearOverYearChart.css';

const WIDTH = 700;
const HEIGHT = 170;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 22;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

// สีไล่จากปีปัจจุบัน (colorIndex 0, เข้ม/เด่นสุด) ไปปีเก่ากว่า — วนซ้ำถ้ามีมากกว่า 6 เส้น
// (ไม่น่าเกิดขึ้นจริงเพราะ buildPeriodChain จำกัดไว้สูงสุด 6 ปีอยู่แล้ว) เลือกให้ห่างกัน
// มากที่สุดทั้งเฉดสีและความเข้ม (ไม่ใช้สีจากธีมที่ใกล้เคียงกันอย่าง terracotta/gold
// ติดกัน เพราะทั้งคู่เป็นโทนน้ำตาลส้มที่แยกยากมากบนเส้นกราฟบาง ๆ) — เพิ่มสีน้ำเงินอมเทา
// (ไม่มีในธีมหลัก ใช้เฉพาะกราฟนี้จุดเดียว) เพื่อให้มีเฉดเย็นตัดกับโทนเขียว/น้ำตาล/แดงที่
// เหลือทั้งหมดของธีม — export ไว้ให้ AnalyticsTab.jsx ใช้สีเดียวกันกับจุด toggle chip
export const YOY_SERIES_COLORS = [
  'var(--green-soft)',
  'var(--red-soft)',
  '#4F7396',
  'var(--gold)',
  'var(--sage)',
  'var(--muted)',
];

// ลวดลายเส้นประของแต่ละปีย้อนหลัง (ปีปัจจุบัน colorIndex 0 เป็นเส้นทึบเสมอ ไม่ใช้ array
// นี้) ให้ต่างกันชัดทั้งความถี่และจังหวะ ไม่ใช่แค่สี เผื่อพิมพ์ขาวดำหรือแยกสีลำบาก
const DASH_PATTERNS = ['5 4', '2 3', '8 2 2 2', '1 3', '6 2 1 2'];

function colorFor(colorIndex) {
  return YOY_SERIES_COLORS[colorIndex % YOY_SERIES_COLORS.length];
}
function dashFor(colorIndex) {
  return DASH_PATTERNS[(colorIndex - 1 + DASH_PATTERNS.length) % DASH_PATTERNS.length];
}

/**
 * props:
 *   monthLabels: string[] ป้ายเดือนสำหรับแกน x (จาก buildMultiYearComparison())
 *   series: { key, label, points: { value, hasData }[], total, colorIndex, isCurrent }[]
 *     เฉพาะปีที่ต้องการแสดงจริง (กรองแล้วจากฝั่ง AnalyticsTab.jsx ตามที่ผู้ใช้เลือก) —
 *     สีอ้างอิงจาก colorIndex เดิมเสมอ ไม่ใช่ตำแหน่งใน array นี้ เพื่อให้สีแต่ละปีคงที่
 *     ไม่เปลี่ยนเวลาผู้ใช้ซ่อน/แสดงปีอื่น
 */
export default function YearOverYearChart({ monthLabels, series }) {
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const maxVal = Math.max(0, ...allValues);
  const minVal = Math.min(0, ...allValues);
  const valueRange = maxVal - minVal || 1;

  const n = monthLabels.length;
  const stepX = n > 1 ? CHART_WIDTH / (n - 1) : 0;

  function xAt(i) {
    return PADDING_LEFT + i * stepX;
  }
  function yAt(value) {
    return PADDING_TOP + CHART_HEIGHT * (1 - (value - minVal) / valueRange);
  }
  const zeroY = yAt(0);

  const seriesWithGeometry = series.map((s) => {
    const points = s.points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), ...p }));
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return { ...s, points, path, color: colorFor(s.colorIndex) };
  });

  return (
    <div className="yoy-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="yoy-chart"
        role="img"
        aria-label="กราฟเส้นเทียบรายได้สุทธิรายเดือนหลายปีย้อนหลัง"
      >
        {minVal < 0 && (
          <line x1={PADDING_LEFT} y1={zeroY} x2={WIDTH - PADDING_RIGHT} y2={zeroY} className="yoy-zero-baseline" />
        )}

        {/* วาดปีเก่ากว่าก่อน (อยู่ข้างล่าง) แล้ววาดปีปัจจุบันทับบนสุด ให้เส้นปีปัจจุบันเด่นที่สุดเสมอ */}
        {[...seriesWithGeometry].sort((a, b) => b.colorIndex - a.colorIndex).map((s) => (
          <path
            key={s.key}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={s.isCurrent ? 2.4 : 1.6}
            strokeDasharray={s.isCurrent ? undefined : dashFor(s.colorIndex)}
            strokeOpacity={s.isCurrent ? 1 : 0.85}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {seriesWithGeometry.map((s) => (
          <g key={`dots-${s.key}`}>
            {s.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={s.isCurrent ? 3.2 : 2.4}
                fill={s.color}
                stroke="var(--bg-card)"
                strokeWidth={1.2}
                opacity={p.hasData ? 1 : 0.35}
              />
            ))}
          </g>
        ))}

        {monthLabels.map((label, i) => (
          <text key={i} x={xAt(i)} y={HEIGHT - 6} textAnchor="middle" className="yoy-month-label">
            {label}
          </text>
        ))}
      </svg>
      <div className="yoy-hint">จุดจาง = เดือนที่ยังไม่มีข้อมูล</div>
    </div>
  );
}
