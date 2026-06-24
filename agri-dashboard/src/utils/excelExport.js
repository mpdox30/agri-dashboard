// src/utils/excelExport.js
//
// ฟังก์ชันช่วยสร้างไฟล์ .xlsx จากข้อมูลที่คำนวณไว้แล้ว ใช้ร่วมกันทั้งปุ่มดาวน์โหลดของ
// หน้าแรกและหน้าวิเคราะห์ เพื่อไม่ให้โค้ดสร้างไฟล์ Excel ซ้ำกันคนละที่
//
// หมายเหตุเรื่องความปลอดภัย: ใช้ไลบรารี "xlsx" (SheetJS) เวอร์ชันที่ตรวจสอบแล้วมี
// CVE 2 รายการ (Prototype Pollution, ReDoS) แต่ทั้งสองรายการเกิดเฉพาะตอน "อ่าน"
// ไฟล์ที่ถูกสร้างมาเพื่อโจมตีโดยเฉพาะ — ตรวจสอบแล้วว่าหน้านี้ใช้แค่ "เขียน/สร้าง" ไฟล์
// จากข้อมูลที่เรารู้ที่มาแน่นอนเท่านั้น ไม่มีจุดไหนอ่านไฟล์ที่ผู้ใช้อัปโหลดเลย จึงไม่เข้า
// เงื่อนไขที่ช่องโหว่นี้จะถูกใช้โจมตีได้จริง

import * as XLSX from 'xlsx';

/**
 * สร้าง 1 ชีตจาก headers + rows (array of array ธรรมดา ไม่ใช่ object) แล้วเพิ่มเข้า
 * workbook ที่ส่งมา
 * sheet: { name: string, headers: string[], rows: (string|number)[][] }
 */
function addSheet(workbook, sheet) {
  const data = [sheet.headers, ...sheet.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  // ตั้งความกว้างคอลัมน์อัตโนมัติแบบหยาบ ๆ จากความยาวข้อความที่ยาวที่สุดในคอลัมน์นั้น
  // (ทำให้เปิดไฟล์มาอ่านได้ทันทีโดยไม่ต้องลากขยายคอลัมน์เอง)
  const colWidths = sheet.headers.map((h, colIdx) => {
    const maxLen = Math.max(
      String(h).length,
      ...sheet.rows.map((r) => String(r[colIdx] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  worksheet['!cols'] = colWidths;
  // ชื่อชีตห้ามมีอักขระบางตัวและห้ามยาวเกิน 31 ตัวอักษร (ข้อจำกัดของฟอร์แมต xlsx เอง)
  const safeName = sheet.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
}

/**
 * สร้างและดาวน์โหลดไฟล์ .xlsx จากหลายชีตในครั้งเดียว
 * sheets: { name, headers, rows }[]
 * filename: ชื่อไฟล์ (ไม่ต้องมี .xlsx ต่อท้าย จะเติมให้เอง)
 */
export function downloadWorkbook(sheets, filename) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => addSheet(workbook, sheet));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
