// src/components/YearOverYearChart.jsx
//
// กราฟเส้นซ้อนหลายปี เทียบรายได้สุทธิรายเดือน ปีที่เลือกอยู่กับปีย้อนหลังหลายปี (ผู้ใช้
// เลือกได้ว่าจะโชว์ปีไหนบ้างผ่าน toggle chip ใน AnalyticsTab.jsx — component นี้แค่วาด
// series ที่ได้รับมา ไม่รู้เรื่องการเลือกเอง) — SVG วาดเอง ตามธรรมเนียมเดียวกับ
// SeasonalLineChart.jsx
//
// เพิ่มใน v2: เส้นอ้างอิงแนวตั้งตามเมาส์/นิ้ว/ลูกศรคีย์บอร์ด พร้อมกล่องค่าของทุกปีในเดือนนั้น,
// เส้นกราฟถูกเปิดเผยจากซ้ายไปขวาเมื่อเลื่อนมาเห็น, และปุ่ม "ดูค่าเป็นตาราง"
import { YOY_SERIES_COLORS } from './yoyColors';
import useCrosshair from './charts/useCrosshair';
import SvgTooltip from './charts/SvgTooltip';
import WipeReveal from './charts/WipeReveal';
import DataTableToggle from './charts/DataTableToggle';
import './charts/charts.css';
import './YearOverYearChart.css';

const WIDTH = 700;
const HEIGHT = 170;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 22;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

// ลวดลายเส้นประของแต่ละปีย้อนหลัง (ปีปัจจุบัน colorIndex 0 เป็นเส้นทึบเสมอ ไม่ใช้ array
// นี้) ให้ต่างกันชัดทั้งความถี่และจังหวะ ไม่ใช่แค่สี เผื่อพิมพ์ขาวดำหรือแยกสีลำบาก
const DASH_PATTERNS = ['5 4', '2 3', '8 2 2 2', '1 3', '6 2 1 2'];

function colorFor(colorIndex) {
  return YOY_SERIES_COLORS[colorIndex % YOY_SERIES_COLORS.length];
}
function dashFor(colorIndex) {
  return DASH_PATTERNS[(colorIndex - 1 + DASH_PATTERNS.length) % DASH_PATTERNS.length];
}

const formatBaht = (n) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);

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

  const xs = monthLabels.map((_, i) => xAt(i));
  const { active, bind } = useCrosshair(xs, WIDTH);

  const seriesWithGeometry = series.map((s) => {
    const points = s.points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), ...p }));
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return { ...s, points, path, color: colorFor(s.colorIndex) };
  });

  const orderedForTip = [...seriesWithGeometry].sort((a, b) => a.colorIndex - b.colorIndex);
  const tipLines =
    active === null
      ? null
      : orderedForTip.map((s) => ({
          label: s.label,
          value: s.points[active] && s.points[active].hasData ? `${formatBaht(s.points[active].value)} บาท` : 'ยังไม่มีข้อมูล',
          color: s.color,
        }));
  const tipY =
    active === null
      ? 0
      : Math.min(...seriesWithGeometry.map((s) => (s.points[active] ? s.points[active].y : HEIGHT)));

  const tableColumns = [{ key: 'month', label: 'เดือน' }, ...orderedForTip.map((s) => ({ key: s.key, label: s.label, align: 'right' }))];
  const tableRows = monthLabels.map((label, i) => {
    const row = { key: label + i, month: label };
    orderedForTip.forEach((s) => {
      row[s.key] = s.points[i] && s.points[i].hasData ? formatBaht(s.points[i].value) : null;
    });
    return row;
  });

  return (
    <div className="yoy-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="yoy-chart chart-focus-ring"
        role="img"
        aria-label="กราฟเส้นเทียบรายได้สุทธิรายเดือนหลายปีย้อนหลัง ใช้ปุ่มลูกศรซ้ายขวาเพื่ออ่านค่าแต่ละเดือน หรือเปิดดูเป็นตารางด้านล่าง"
        {...bind}
      >
        {minVal < 0 && (
          <line x1={PADDING_LEFT} y1={zeroY} x2={WIDTH - PADDING_RIGHT} y2={zeroY} className="yoy-zero-baseline" />
        )}

        <WipeReveal width={WIDTH} height={HEIGHT}>
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
                  r={(s.isCurrent ? 3.2 : 2.4) + (active === i ? 1.6 : 0)}
                  fill={s.color}
                  stroke="var(--bg-card)"
                  strokeWidth={1.2}
                  opacity={p.hasData ? 1 : 0.35}
                />
              ))}
            </g>
          ))}
        </WipeReveal>

        {monthLabels.map((label, i) => (
          <text
            key={i}
            x={xAt(i)}
            y={HEIGHT - 6}
            textAnchor="middle"
            className={active === i ? 'yoy-month-label yoy-month-label--active' : 'yoy-month-label'}
          >
            {label}
          </text>
        ))}

        {active !== null && (
          <>
            <line x1={xs[active]} x2={xs[active]} y1={PADDING_TOP - 6} y2={HEIGHT - PADDING_BOTTOM} className="chart-crosshair-line" />
            <SvgTooltip x={xs[active]} y={tipY} title={monthLabels[active]} lines={tipLines} viewBoxWidth={WIDTH} top={0} />
          </>
        )}
      </svg>
      <div className="yoy-hint">จุดจาง = เดือนที่ยังไม่มีข้อมูล · ชี้หรือแตะที่กราฟเพื่อดูค่าแต่ละเดือน</div>
      <DataTableToggle columns={tableColumns} rows={tableRows} caption="รายได้สุทธิรายเดือนเทียบหลายปี หน่วยบาท" />
    </div>
  );
}
