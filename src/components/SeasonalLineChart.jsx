// src/components/SeasonalLineChart.jsx
//
// กราฟเส้นรายเดือน พร้อมแถบสีพื้นหลังเน้นช่วงฤดูฝน/ฤดูแล้ง — ใช้ SVG วาดเอง ไม่ต้องพึ่ง
// library กราฟเพิ่ม เพราะมีจุดข้อมูลแค่ 12 จุด ไม่ซับซ้อนพอจะคุ้มกับการเพิ่ม dependency
import './SeasonalLineChart.css';

const WIDTH = 700;
const HEIGHT_NORMAL = 130;
const HEIGHT_TALL = 220;
const PADDING_LEFT_NORMAL = 36;
const PADDING_RIGHT_NORMAL = 12;
const PADDING_LEFT_FULL = 14;
const PADDING_RIGHT_FULL = 14;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 22;

function formatCompact(n) {
  return String(Math.round(n / 1000));
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
 *   tall: boolean — ถ้าจริง ใช้ความสูงมากขึ้น (สำหรับตอนเป็นกราฟเด่นของหน้า เต็มความกว้าง)
 *   full: boolean — ถ้าจริง ลดขอบซ้าย/ขวาให้น้อยที่สุด ให้กราฟยืดเต็มพื้นที่การ์ดมากขึ้น
 */
export default function SeasonalLineChart({ monthly, tall = false, full = false }) {
  const HEIGHT = tall ? HEIGHT_TALL : HEIGHT_NORMAL;
  const PADDING_LEFT = full ? PADDING_LEFT_FULL : PADDING_LEFT_NORMAL;
  const PADDING_RIGHT = full ? PADDING_RIGHT_FULL : PADDING_RIGHT_NORMAL;
  const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

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
  const bands = buildSeasonBands(monthly);

  return (
    <div className="seasonal-line-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={tall ? 'seasonal-line-chart seasonal-line-chart--tall' : 'seasonal-line-chart'}
        role="img"
        aria-label="กราฟเส้นรายได้สุทธิรายเดือน แยกฤดูฝนและฤดูแล้ง"
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

        {/* เส้นกราฟหลัก */}
        <path d={linePath} className="season-line-path" fill="none" />

        {/* จุดข้อมูลแต่ละเดือน สีตามฤดู + label ค่าด้านบน + label เดือนด้านล่าง */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} className={p.isRainy ? 'season-dot rainy-dot' : 'season-dot dry-dot'} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" className="season-value-label">
              {formatCompact(p.netIncome)}
            </text>
            <text x={p.x} y={HEIGHT - 6} textAnchor="middle" className="season-month-label">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="seasonal-line-chart-footer">
        <div className="seasonal-line-chart-legend">
          <span className="legend-item">
            <span className="legend-swatch rainy-swatch" /> ฤดูฝน
          </span>
          <span className="legend-item">
            <span className="legend-swatch dry-swatch" /> ฤดูแล้ง
          </span>
        </div>
        <span className="seasonal-line-chart-unit">หน่วยตัวเลขบนกราฟ: x1,000 (บาท)</span>
      </div>
    </div>
  );
}
