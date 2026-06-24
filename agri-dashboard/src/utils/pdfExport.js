// src/utils/pdfExport.js
//
// สร้างรายงานสรุปผู้บริหาร (PDF) จากข้อมูลที่คำนวณไว้แล้ว — jsPDF ไม่มีฟอนต์ไทยมาให้
// ในตัว ต้องฝังฟอนต์เอง (ดู src/assets/sarabunFontBase64.js — ฟอนต์ Sarabun จาก Google
// Fonts ลิขสิทธิ์ SIL OFL 1.1 ซึ่งอนุญาตให้ฝังในเอกสารที่สร้างได้โดยไม่กระทบลิขสิทธิ์ของ
// เอกสารนั้นเอง — Sarabun เป็นฟอนต์มาตรฐานราชการไทยตามมติคณะรัฐมนตรีด้วย เหมาะกับรายงาน
// ราชการมากกว่า Tahoma ซึ่งเป็นฟอนต์ลิขสิทธิ์ของ Microsoft ที่ห้ามฝังในซอร์สโค้ดที่
// แจกจ่ายต่อตาม EULA)

import { jsPDF } from 'jspdf';
import { SARABUN_FONT_BASE64 } from '../assets/sarabunFontBase64';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * วาดกราฟแท่งรายเดือนลงบน canvas ที่ไม่ได้แสดงบนหน้าจอ แล้วคืนเป็น PNG data URL
 * เพื่อฝังลง PDF — ใช้ Canvas 2D ธรรมดา ไม่ต้องพึ่ง library กราฟเพิ่ม
 */
function drawTrendChartImage(monthlyTrend) {
  const canvas = document.createElement('canvas');
  const scale = 2; // เรนเดอร์ที่ความละเอียดสูงกว่าจริง 2x แล้วค่อยย่อใน PDF ให้ภาพไม่แตก
  const width = 700;
  const height = 280;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#FFFEFA';
  ctx.fillRect(0, 0, width, height);

  const values = monthlyTrend.map((m) => m.netIncome);
  const maxVal = Math.max(1, ...values.filter((v) => v !== null).map((v) => Math.abs(v)));
  const chartTop = 30;
  const chartBottom = height - 40;
  const chartHeight = chartBottom - chartTop;
  const barAreaWidth = width - 40;
  const barWidth = (barAreaWidth / monthlyTrend.length) * 0.6;
  const gap = (barAreaWidth / monthlyTrend.length) * 0.4;

  monthlyTrend.forEach((m, i) => {
    const x = 20 + i * (barWidth + gap) + gap / 2;
    const hasData = m.netIncome !== null;
    const barHeight = hasData ? Math.max((Math.abs(m.netIncome) / maxVal) * chartHeight, 4) : 3;
    ctx.fillStyle = hasData ? '#41614F' : '#c9cfc4';
    ctx.fillRect(x, chartBottom - barHeight, barWidth, barHeight);

    ctx.fillStyle = '#1A1A1A';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const valueLabel = hasData ? (m.netIncome / 1_000_000).toFixed(2) : '-';
    ctx.fillText(valueLabel, x + barWidth / 2, chartBottom - barHeight - 6);

    ctx.fillStyle = '#6b6552';
    ctx.font = '11px sans-serif';
    ctx.fillText(m.label, x + barWidth / 2, chartBottom + 16);
  });

  return canvas.toDataURL('image/png');
}

/**
 * สร้างไฟล์ PDF รายงานสรุปผู้บริหาร แล้วเริ่มดาวน์โหลดทันที
 * data: ผลลัพธ์จาก buildExecutiveSummaryData()
 */
export function generateExecutiveSummaryPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Sarabun.ttf', SARABUN_FONT_BASE64);
  doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
  doc.setFont('Sarabun');

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(45, 74, 62); // var(--green)
  doc.text('รายงานสรุปผู้บริหาร', margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(107, 101, 82); // var(--muted)
  doc.text(`ระบบติดตามรายได้แปลงเกษตรทฤษฎีใหม่ — ${data.periodLabel}`, margin, y);
  y += 12;

  // แถบ KPI หลัก
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  const kpis = [
    ['รายได้สุทธิรวม', `${formatBaht(data.totalNetIncome)} บาท`],
    ['ลดรายจ่ายครัวเรือนรวม', `${formatBaht(data.totalHousehold)} บาท`],
    ['ชุมชนที่มีข้อมูลในช่วงนี้', `${data.communitiesWithDataCount} / ${data.totalCommunities} ชุมชน`],
    ['ชุมชนที่มีข้อมูลครบทุกเดือน', `${data.completenessCount} / ${data.totalCommunities} ชุมชน`],
  ];
  const kpiColWidth = (pageWidth - margin * 2) / 2;
  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * kpiColWidth;
    const ky = y + row * 16;
    doc.setFontSize(9);
    doc.setTextColor(107, 101, 82);
    doc.text(kpi[0], x, ky);
    doc.setFontSize(13);
    doc.setTextColor(45, 74, 62);
    doc.text(kpi[1], x, ky + 6);
  });
  y += 16 * Math.ceil(kpis.length / 2) + 8;

  // กราฟแนวโน้มรายเดือน (วาดเป็นรูปภาพ แล้วฝังเข้า PDF)
  doc.setFontSize(12);
  doc.setTextColor(45, 74, 62);
  doc.text('แนวโน้มรายได้สุทธิรายเดือน', margin, y);
  y += 4;
  const chartImage = drawTrendChartImage(data.monthlyTrend);
  const chartWidth = pageWidth - margin * 2;
  const chartHeight = chartWidth * (280 / 700);
  doc.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
  y += chartHeight + 10;

  // Top 5 รายได้สูงสุด + Top 5 เติบโตเร็วสุด (ตารางคู่ขนาน)
  const halfWidth = (pageWidth - margin * 2 - 8) / 2;

  function drawRankList(title, items, x, formatValue) {
    doc.setFontSize(11);
    doc.setTextColor(45, 74, 62);
    doc.text(title, x, y);
    let rowY = y + 6;
    doc.setFontSize(9);
    items.forEach((item, i) => {
      doc.setTextColor(26, 26, 26);
      doc.text(`${i + 1}. ชุมชน${item.community_key}`, x, rowY);
      doc.setTextColor(107, 101, 82);
      doc.text(formatValue(item), x, rowY + 4.2);
      rowY += 10;
    });
    return rowY;
  }

  const endY1 = drawRankList(
    'รายได้สุทธิสูงสุด 5 อันดับ',
    data.top5Income,
    margin,
    (item) => `${formatBaht(item.netIncome)} บาท (${item.province})`
  );
  const endY2 = drawRankList(
    'การเติบโตของรายได้สูงสุด 5 อันดับ',
    data.top5Growth,
    margin + halfWidth + 8,
    (item) => `${item.growthPct > 0 ? '+' : ''}${item.growthPct.toFixed(1)}% (${item.province})`
  );
  y = Math.max(endY1, endY2) + 6;

  doc.setFontSize(8);
  doc.setTextColor(107, 101, 82);
  doc.text(
    `สร้างรายงานเมื่อ ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    margin,
    doc.internal.pageSize.getHeight() - 12
  );

  doc.save(`รายงานสรุปผู้บริหาร_${data.periodLabel.replace(/\s/g, '')}.pdf`);
}
