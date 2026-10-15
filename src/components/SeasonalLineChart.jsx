// src/components/SeasonalLineChart.jsx
//
// กราฟเส้นรายเดือน พร้อมแถบสีพื้นหลังเน้นช่วงฤดูฝน/ฤดูแล้ง — ใช้ SVG วาดเอง ไม่ต้องพึ่ง
// library กราฟเพิ่ม เพราะมีจุดข้อมูลแค่ 12 จุด ไม่ซับซ้อนพอจะคุ้มกับการเพิ่ม dependency
import useCrosshair from './charts/useCrosshair';
import SvgTooltip from './charts/SvgTooltip';
import DrawInPath from './charts/DrawInPath';
import AreaFill from './charts/AreaFill';
import DataTableToggle from './charts/DataTableToggle';
import './charts/charts.css';
import './SeasonalLineChart.css';

const WIDTH = 700;
const HEIGHT = 130;
const PADDING_LEFT = 36;
const PADDING_RIGHT = 12;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 22;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const TABLE_COLUMNS = [
  { key: 'month', label: 'เดือน' },
  { key: 'season', label: 'ฤดู' },
  { key: 'net', label: 'รายได้สุทธิ (บาท)', align: 'right' },
];

function formatCompact(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/**
 * จัดกลุ่มเดือนที่ติดกันและฤดูเดียวกันให้เป็นช่วง (band) — ต้องคำนวณสด ไม่ hardcode ว่า
 * ฤดูไหนอยู่ตรงไหน เพราะลำดับเดือนเปลี่ยนได้ทั้งโหมดปีงบ (ต.ค.เริ่ม) และปีปฏิทิน (ม.ค.เริ่ม)
 * ซึ่งจะทำให้ฤดูฝน/แล้ง "ตัด" คนละจุดกันไปตามลำดับเดือนที่ใช้
 */
function buildSeasonBands(monthly) {
  const bands = [];
  monthly.forEach((m, i) => {
    const last = bands[bands.length - 1];
    if (last && last.isRainy === m.isRainy) {
      last.endIndex = i;
    } else {
      bands.push({ startIndex: i, endIndex: i, isRainy: m.isRainy });
    }
  });
  return bands;
}

/**
 * props:
 *   monthly: { label: string, netIncome: number, isRainy: boolean }[] (12 เดือน เรียงตามลำดับที่ใช้แสดง)
 */
export default function SeasonalLineChart({ monthly }) {
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

  // แสดงตัวเลขกำกับเฉพาะจุดสูงสุด จุดล่าสุด และจุดที่ผู้ใช้ชี้อยู่ ที่เหลืออ่านจากกล่องค่าหรือตาราง
  // (12 ป้ายตัวเลขเต็มพร้อมจุลภาคแน่นเกินไปบนจอมือถือ)
  const peakIndex = values.indexOf(maxVal);
  const lastIndex = points.length - 1;
  const labelIndexes = new Set([peakIndex, lastIndex]);
  if (active !== null) labelIndexes.add(active);
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const zeroY = yAt(0);
  const bands = buildSeasonBands(monthly);

  return (
    <div className="seasonal-line-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="seasonal-line-chart chart-focus-ring"
        role="img"
        aria-label="กราฟเส้นรายได้สุทธิรายเดือน แยกฤดูฝนและฤดูแล้ง ใช้ปุ่มลูกศรซ้ายขวาเพื่ออ่านค่าแต่ละเดือน หรือเปิดดูเป็นตารางด้านล่าง"
        {...bind}
      >
        {/* แถบพื้นหลังเน้นช่วงฤดู */}
        {bands.map((band, i) => {
          const x1 = xAt(band.startIndex) - (band.startIndex === 0 ? 0 : stepX / 2);
          const x2 = xAt(band.endIndex) + (band.endIndex === monthly.length - 1 ? 0 : stepX / 2);
          return (
            <rect
              key={i}
              x={Math.max(x1, PADDING_LEFT)}
              y={PADDING_TOP}
              width={Math.min(x2, WIDTH - PADDING_RIGHT) - Math.max(x1, PADDING_LEFT)}
              height={CHART_HEIGHT}
              className={band.isRainy ? 'season-band rainy-band' : 'season-band dry-band'}
            />
          );
        })}

        {/* เส้นฐาน 0 (โชว์เฉพาะถ้ามีค่าติดลบจริง ไม่งั้นจะซ้ำกับเส้นพื้น chart เปล่าๆ) */}
        {minVal < 0 && (
          <line x1={PADDING_LEFT} y1={zeroY} x2={WIDTH - PADDING_RIGHT} y2={zeroY} className="zero-baseline" />
        )}

        <AreaFill points={points} baselineY={PADDING_TOP + CHART_HEIGHT} />

        {/* เส้นกราฟหลัก */}
        <DrawInPath d={linePath} className="season-line-path" />

        {/* จุดข้อมูลแต่ละเดือน สีตามฤดู + label ค่าเฉพาะจุดสำคัญ + label เดือนด้านล่าง */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={active === i ? 5.5 : 4}
              className={p.isRainy ? 'season-dot rainy-dot' : 'season-dot dry-dot'}
            />
            {labelIndexes.has(i) && active === null && (
              <text x={p.x} y={Math.max(p.y - 8, 10)} textAnchor="middle" className="season-value-label">
                {formatCompact(p.netIncome)}
              </text>
            )}
            <text x={p.x} y={HEIGHT - 6} textAnchor="middle" className="season-month-label">
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
              title={`${points[active].label} · ${points[active].isRainy ? 'ฤดูฝน' : 'ฤดูแล้ง'}`}
              lines={[{ label: 'รายได้สุทธิ', value: `${formatCompact(points[active].netIncome)} บาท`, color: points[active].isRainy ? 'var(--green-soft)' : 'var(--terracotta)' }]}
              viewBoxWidth={WIDTH}
            />
          </>
        )}
      </svg>
      <div className="seasonal-line-chart-legend">
        <span className="legend-item">
          <span className="legend-swatch rainy-swatch" /> ฤดูฝน
        </span>
        <span className="legend-item">
          <span className="legend-swatch dry-swatch" /> ฤดูแล้ง
        </span>
      </div>
      <DataTableToggle
        columns={TABLE_COLUMNS}
        rows={monthly.map((m) => ({ key: m.label, month: m.label, season: m.isRainy ? 'ฤดูฝน' : 'ฤดูแล้ง', net: formatCompact(m.netIncome) }))}
        caption="รายได้สุทธิรายเดือน หน่วยบาท"
      />
    </div>
  );
}
