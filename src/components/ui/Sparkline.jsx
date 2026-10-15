// src/components/ui/Sparkline.jsx
//
// เส้นแนวโน้มเล็กๆ สำหรับใส่ในแถวตาราง/การ์ด ไม่มีแกน ไม่มีตัวเลข ให้เห็นรูปทรงของข้อมูลทันที
// ค่า null/undefined = เดือนที่ไม่มีข้อมูล เส้นจะขาดตรงนั้นแทนที่จะลากไปที่ศูนย์ให้เข้าใจผิด
import './ui.css';

/**
 * props:
 *   values: (number | null)[] เรียงตามเวลา
 *   label: คำอธิบายสำหรับโปรแกรมอ่านหน้าจอ (ไม่ใส่ = ถือเป็นเครื่องประดับ ซ่อนจากโปรแกรมอ่าน)
 */
export default function Sparkline({ values, width = 96, height = 28, color = 'var(--sage)', label, area = true, className = '' }) {
  const pad = 3;
  const finite = values.filter((v) => Number.isFinite(v));
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };

  if (finite.length < 2) {
    return (
      <svg className={`spark ${className}`.trim()} viewBox={`0 0 ${width} ${height}`} width={width} height={height} {...a11y}>
        <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} className="spark__empty" />
      </svg>
    );
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const xAt = (i) => pad + i * stepX;
  const yAt = (v) => (max === min ? height / 2 : pad + (height - pad * 2) * (1 - (v - min) / range));

  // แยกเป็นช่วงต่อเนื่อง ตัดที่เดือนไม่มีข้อมูล
  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (Number.isFinite(v)) {
      current.push([xAt(i), yAt(v)]);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length) segments.push(current);

  const lineD = segments
    .map((seg) => seg.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '))
    .join(' ');
  const areaD = segments
    .filter((seg) => seg.length > 1)
    .map((seg) => {
      const first = seg[0];
      const last = seg[seg.length - 1];
      const body = seg.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
      return `M${first[0].toFixed(1)} ${height - pad} ${body} L${last[0].toFixed(1)} ${height - pad} Z`;
    })
    .join(' ');
  const lastSeg = segments[segments.length - 1];
  const lastPoint = lastSeg[lastSeg.length - 1];

  return (
    <svg className={`spark ${className}`.trim()} viewBox={`0 0 ${width} ${height}`} width={width} height={height} {...a11y}>
      {area && <path d={areaD} className="spark__area" fill={color} />}
      <path d={lineD} className="spark__line" stroke={color} />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.2" className="spark__dot" fill={color} />
    </svg>
  );
}
