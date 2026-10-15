// src/components/charts/SvgTooltip.jsx
//
// กล่องข้อความลอยในกราฟ SVG: หัวเรื่อง + รายการค่าพร้อมจุดสี พลิกด้านอัตโนมัติเมื่อชิดขอบ
// วางใน <svg> เดียวกับกราฟ ใช้พิกัด viewBox
const LINE_H = 16;
const PAD_X = 10;
const PAD_Y = 8;
const CHAR_W = 6.6; // ค่าประมาณความกว้างตัวอักษรต่อหนึ่งตัว (ภาษาไทยผสมตัวเลข)

/**
 * props:
 *   x, y: ตำแหน่งจุดที่ชี้ (พิกัด viewBox)
 *   title: หัวเรื่อง เช่น "มีนาคม"
 *   lines: { label, value, color }[]  value เป็นข้อความที่จัดรูปแบบแล้ว
 *   viewBoxWidth: ความกว้าง viewBox ใช้คำนวณการพลิกด้าน
 *   top: ขอบบนที่กล่องไม่ควรทะลุ (ค่าเริ่มต้น 0)
 */
export default function SvgTooltip({ x, y, title, lines, viewBoxWidth, top = 0 }) {
  if (!lines || !lines.length) return null;
  const rows = [title, ...lines.map((l) => `${l.label}: ${l.value}`)];
  const maxChars = Math.max(...rows.map((r) => r.length));
  const width = Math.ceil(maxChars * CHAR_W + PAD_X * 2 + 12);
  const height = PAD_Y * 2 + LINE_H * (lines.length + 1);
  const gap = 12;
  let bx = x + gap;
  if (bx + width > viewBoxWidth - 2) bx = x - gap - width;
  if (bx < 2) bx = 2;
  let by = y - height - gap;
  if (by < top) by = Math.min(y + gap, top + 4);
  return (
    <g className="svg-tip" pointerEvents="none" transform={`translate(${bx} ${by})`}>
      <rect className="svg-tip__box" width={width} height={height} rx="8" />
      <text className="svg-tip__title" x={PAD_X} y={PAD_Y + 11}>
        {title}
      </text>
      {lines.map((l, i) => (
        <g key={l.label} transform={`translate(${PAD_X} ${PAD_Y + LINE_H * (i + 1) + 11})`}>
          <circle cx="4" cy="-4" r="3.5" fill={l.color} />
          <text className="svg-tip__text" x="14" y="0">
            {l.label}: {l.value}
          </text>
        </g>
      ))}
    </g>
  );
}
