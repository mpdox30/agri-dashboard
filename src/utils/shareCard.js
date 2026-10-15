// src/utils/shareCard.js
//
// วาด "การ์ดรูปสรุป" ลงบน canvas เป็นภาพ PNG จัตุรัส 1080x1080 (ขนาดที่ LINE และโซเชียลแสดงได้ดี) ไม่พึ่งไลบรารีเพิ่ม
// ใช้เฉพาะข้อมูลระดับชุมชน/จังหวัด/ภาพรวม ไม่ใส่ชื่อสมาชิกรายบุคคลเด็ดขาด (เรื่องความเป็นส่วนตัว)
// สีและฟอนต์ใช้ชุดเดียวกับเว็บ (ครีม เขียว) ไม่ใช้ภาพประกอบหรือโลโก้จากแหล่งอื่น

const SIZE = 1080;
const COLORS = {
  bg: '#f2f7f7',
  card: '#ffffff',
  ink: '#10201f',
  green: '#0b4f4a',
  greenSoft: '#157a6a',
  muted: '#5b6e6d',
  line: '#d8e4e4',
  down: '#b9543f',
  sage: '#7fb2bf',
};
const SERIF = "'Noto Serif Thai', serif";
const SANS = "'Noto Sans Thai', sans-serif";

async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const sample = 'ทดสอบ 0123 รายได้สุทธิ';
  try {
    await Promise.all([
      document.fonts.load(`600 40px ${SERIF}`, sample),
      document.fonts.load(`400 30px ${SANS}`, sample),
      document.fonts.load(`600 30px ${SANS}`, sample),
    ]);
  } catch {
    // ถ้าโหลดฟอนต์ไม่ได้ จะใช้ฟอนต์สำรองของระบบ ภาพยังออกได้
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** ลดขนาดตัวอักษรลงจนข้อความกว้างไม่เกิน maxWidth */
function fitFont(ctx, text, weight, startSize, family, maxWidth, minSize = 40) {
  let size = startSize;
  for (;;) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) return size;
    size -= 4;
  }
}

/** ตัดข้อความยาวให้ขึ้นบรรทัดใหม่ตามความกว้าง (ภาษาไทยไม่มีเว้นวรรค จึงตัดทีละตัวอักษรเมื่อจำเป็น) */
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawSparkline(ctx, values, x, y, w, h) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const px = (i) => x + i * step;
  const py = (v) => y + h - ((v - min) / range) * h;

  ctx.strokeStyle = COLORS.greenSoft;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let started = false;
  let lastIdx = -1;
  ctx.beginPath();
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      started = false;
      return;
    }
    if (!started) ctx.moveTo(px(i), py(v));
    else ctx.lineTo(px(i), py(v));
    started = true;
    lastIdx = i;
  });
  ctx.stroke();
  if (lastIdx >= 0) {
    ctx.fillStyle = COLORS.greenSoft;
    ctx.beginPath();
    ctx.arc(px(lastIdx), py(values[lastIdx]), 11, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * options:
 *   title: หัวเรื่อง เช่น "ชุมชนบ้านนา · ปีงบ 68–69"
 *   label: ป้ายเหนือตัวเลขใหญ่ เช่น "รายได้สุทธิ"
 *   value: ตัวเลขใหญ่ (ข้อความ จัดรูปแบบแล้ว) เช่น "272,574"
 *   unit: หน่วย เช่น "บาท"
 *   deltaText: เช่น "↑ 3.6% จากเดือนเดียวกันของปีก่อน" (ไม่ใส่ก็ได้)
 *   deltaTone: 'up' | 'down' | 'flat'
 *   lines: ข้อความบรรทัดรอง (สูงสุด 3 บรรทัด)
 *   series: ค่ารายเดือนสำหรับเส้นแนวโน้ม (null = ไม่มีข้อมูล) ไม่ใส่ก็ได้
 *   footer: เช่น "ข้อมูลล่าสุด: ส.ค. 2569"
 * คืน Promise<Blob> (image/png)
 */
export async function renderShareCard(options) {
  const { title, label, value, unit, deltaText, deltaTone = 'flat', lines = [], series, footer } = options;
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // การ์ดสองชั้นเหมือนบนเว็บ: เปลือกจาง ๆ ห่อเนื้อในสีครีมสว่าง
  ctx.fillStyle = 'rgba(11, 79, 74, 0.06)';
  roundRect(ctx, 40, 40, SIZE - 80, SIZE - 80, 44);
  ctx.fill();
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, 52, 52, SIZE - 104, SIZE - 104, 34);
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const left = 110;
  const innerWidth = SIZE - left * 2;

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText('ระบบติดตามรายได้แปลงเกษตรทฤษฎีใหม่', left, 130);

  const titleSize = fitFont(ctx, title, 600, 60, SERIF, innerWidth, 36);
  ctx.fillStyle = COLORS.green;
  ctx.font = `600 ${titleSize}px ${SERIF}`;
  ctx.fillText(title, left, 230);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 36px ${SANS}`;
  ctx.fillText(label, left, 330);

  const unitText = unit ? ` ${unit}` : '';
  ctx.font = `400 44px ${SANS}`;
  const unitWidth = ctx.measureText(unitText).width;
  const valueSize = fitFont(ctx, value, 600, 190, SERIF, innerWidth - unitWidth, 80);
  ctx.fillStyle = COLORS.green;
  ctx.font = `600 ${valueSize}px ${SERIF}`;
  ctx.fillText(value, left, 330 + valueSize * 0.95 + 14);
  const valueWidth = ctx.measureText(value).width;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 44px ${SANS}`;
  ctx.fillText(unitText, left + valueWidth, 330 + valueSize * 0.95 + 14);

  let cursorY = 330 + valueSize * 0.95 + 14 + 70;
  if (deltaText) {
    ctx.fillStyle = deltaTone === 'down' ? COLORS.down : deltaTone === 'up' ? COLORS.greenSoft : COLORS.muted;
    ctx.font = `600 38px ${SANS}`;
    ctx.fillText(deltaText, left, cursorY);
    cursorY += 30;
  }

  if (series && series.filter((v) => Number.isFinite(v)).length >= 2) {
    drawSparkline(ctx, series, left, cursorY + 24, innerWidth - 12, 110);
    cursorY += 24 + 110 + 62;
  } else {
    cursorY += 20;
  }

  ctx.fillStyle = COLORS.ink;
  ctx.font = `400 34px ${SANS}`;
  lines.slice(0, 3).forEach((text) => {
    wrapLines(ctx, text, innerWidth).slice(0, 2).forEach((part) => {
      ctx.fillText(part, left, cursorY);
      cursorY += 50;
    });
  });

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, SIZE - 170);
  ctx.lineTo(SIZE - left, SIZE - 170);
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 28px ${SANS}`;
  if (footer) ctx.fillText(footer, left, SIZE - 120);
  ctx.fillText('สสน. ฝ่ายจัดการน้ำชุมชน · ข้อมูลระดับชุมชน ไม่มีชื่อบุคคล', left, SIZE - 78);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png');
  });
}

/**
 * แชร์รูปผ่านหน้าต่างแชร์ของเครื่อง (มือถือจะมี LINE ให้เลือก) ถ้าเครื่องไม่รองรับให้ดาวน์โหลดไฟล์แทน
 * คืน 'shared' | 'downloaded' | 'cancelled'
 */
export async function shareOrDownload(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // ถ้าแชร์ไม่สำเร็จด้วยเหตุอื่น ตกไปดาวน์โหลดแทน
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
