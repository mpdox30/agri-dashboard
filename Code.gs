/**
 * Code.gs — ค่าคงที่และฟังก์ชันช่วยที่ใช้ร่วมกันทุกไฟล์
 *
 * โครงสร้างโปรเจกต์ Apps Script นี้:
 *   Code.gs        — ค่าคงที่ + ฟังก์ชันช่วยอ่าน/เขียนชีต (ไฟล์นี้)
 *   ReadApi.gs     — doGet() สำหรับหน้าเว็บอ่านข้อมูล (ภาพรวม, รายชุมชน, เช็คล็อกเดือน)
 *   EntryApi.gs    — doPost() รับข้อมูลจากฟอร์มกรอก เขียนเข้า pending_submissions
 *   ApprovalApi.gs — ฟังก์ชันสำหรับหน้าจอตรวจสอบ/อนุมัติ (ดึงรายการ, อนุมัติ, ตีกลับ)
 *   Auth.gs        — ตรวจรหัสผ่านร่วมสำหรับหน้ากรอกข้อมูล/อนุมัติ
 *
 * หมายเหตุ: ไฟล์นี้เขียนให้ใช้ได้ทั้งแบบ Standalone project (แยกจาก Spreadsheet
 * เข้าถึงผ่าน SPREADSHEET_ID) และแบบ Container-bound (ผูกกับ Spreadsheet โดยตรง)
 * ใช้ SPREADSHEET_ID ที่กำหนดไว้ด้านล่างเสมอ ไม่ใช้ getActiveSpreadsheet() เพื่อให้
 * โค้ดเดียวกันใช้ได้ทั้งสองแบบโดยไม่ต้องแก้ไข
 *
 * วิธี deploy (Standalone): ไปที่ script.google.com > New project > วาง 5 ไฟล์นี้
 * ตามชื่อ > Deploy > New deployment > เลือกประเภท "Web app" > Execute as "Me"
 * (เจ้าของไฟล์) > Who has access เลือก "Anyone" (เพราะหน้ากรอกข้อมูล/อนุมัติป้องกัน
 * ด้วยรหัสผ่านของเราเอง ไม่ใช่ระบบสิทธิ์ของ Google) จะได้ URL สำหรับ React frontend
 * เรียกใช้ — ครั้งแรกที่ deploy จะมีหน้าขอสิทธิ์เข้าถึง Spreadsheet ให้กดอนุญาต
 *
 * วิธี deploy (Container-bound): เปิดไฟล์ Google Sheets นี้ > Extensions > Apps
 * Script > วาง 5 ไฟล์นี้ตามชื่อ > ขั้นตอน Deploy เหมือนกับ Standalone ทุกอย่าง
 * โค้ดเดียวกันนี้ใช้ได้ทั้งสองแบบโดยไม่ต้องแก้ไขอะไรเพิ่ม เพราะใช้ SPREADSHEET_ID
 * เปิดไฟล์เสมอ ไม่ได้พึ่ง "การผูกกับไฟล์" แบบเดิม
 */

// Spreadsheet ID ของไฟล์ข้อมูล (ดูจาก URL ระหว่าง /d/ กับ /edit)
const SPREADSHEET_ID = '1bMHY4Wl4bX2N-PI1Qc5k7IqLfqyrq1DJ3otZ4ZmNPVA';

/** เปิด Spreadsheet ด้วย ID เสมอ (ใช้ได้ทั้ง Standalone และ Container-bound) */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ชื่อแท็บในไฟล์นี้ (ต้องตรงกับที่ตั้งไว้ตอนอัปโหลดเป๊ะ ๆ)
const SHEET_COMMUNITIES = 'communities';
const SHEET_MONTHLY_RECORDS = 'monthly_records';
const SHEET_MONTHLY_SUMMARY = 'monthly_summary';
const SHEET_PENDING_SUBMISSIONS = 'pending_submissions';

// คอลัมน์ของ pending_submissions (ต้องตรงกับลำดับใน upload_to_sheets.py ที่สร้างหัวคอลัมน์ไว้)
const PENDING_COLS = [
  'submission_id', 'community_key', 'month', 'submitted_by', 'submitted_at', 'status',
  'reviewer_note', 'reviewed_at',
  'full_name', 'join_year', 'บริโภคในครัวเรือน', 'ขาย', 'แบ่งปัน', 'ซื้อ', 'ผลิตเอง', 'รับฟรี/อื่นๆ',
];

const VALUE_FIELDS = ['บริโภคในครัวเรือน', 'ขาย', 'แบ่งปัน', 'ซื้อ', 'ผลิตเอง', 'รับฟรี/อื่นๆ'];

/**
 * อ่านชีตทั้งแผ่นคืนเป็น array of object โดยใช้แถวแรกเป็น key
 * (ชีตเล็กพอที่จะอ่านทั้งแผ่นได้ในครั้งเดียว ไม่ต้อง pagination)
 *
 * หมายเหตุสำคัญ: Google Sheets อาจ "แปลง" ค่าที่หน้าตาเหมือนวันที่ (เช่น "2026-04")
 * ให้เป็นชนิด Date โดยอัตโนมัติ ไม่ว่าจะตอนอัปโหลดข้อมูลครั้งแรกหรือตอน Apps Script
 * เขียนแถวใหม่เข้าไปทีหลังก็ตาม (ถ้าคอลัมน์ไม่ได้ตั้ง format เป็น Plain text ไว้ก่อน)
 * ถ้าเกิดเหตุนี้ getValues() จะคืนค่าเป็น JS Date object ไม่ใช่ string ซึ่งจะทำให้การ
 * เทียบ string แบบ === ที่ใช้ทั่วทั้งระบบ (เช็คล็อกเดือน, หาเดือนก่อนหน้าสำหรับเทียบ
 * ความผิดปกติ, กรองข้อมูลฝั่ง React) เพี้ยนหมด แม้ค่าจริงจะถูกต้องก็ตาม
 * จึงแปลงคอลัมน์ 'month' กลับเป็น string รูปแบบ yyyy-MM เสมอตรงนี้ที่จุดเดียว
 * เพื่อให้ทุกฟังก์ชันที่เรียก readSheetAsObjects() ได้ค่าที่เชื่อถือได้แบบเดียวกันหมด
 */
function readSheetAsObjects(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ไม่พบชีตชื่อ: ' + sheetName);
  }
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length === 0) return [];

  const headers = values[0];
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const rowValues = values[r];
    // ข้ามแถวที่ว่างสนิททั้งแถว (เช่น แถวเปล่าท้ายชีตจาก resize เกิน)
    if (rowValues.every(function (v) { return v === '' || v === null; })) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let value = rowValues[c];
      if (headers[c] === 'month' && value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
      }
      obj[headers[c]] = value;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * เพิ่มแถวใหม่หลายแถวเข้าชีต ตามลำดับคอลัมน์ที่กำหนด (เร็วกว่า appendRow ทีละแถว
 * เพราะเขียนเป็น batch เดียว)
 */
function appendRowsToSheet(sheetName, columnOrder, rowObjects) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ไม่พบชีตชื่อ: ' + sheetName);
  }
  if (rowObjects.length === 0) return;

  const matrix = rowObjects.map(function (obj) {
    return columnOrder.map(function (col) {
      return obj[col] !== undefined ? obj[col] : '';
    });
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, matrix.length, columnOrder.length).setValues(matrix);
}

/** แปลง Date เป็น string รูปแบบ YYYY-MM-DD HH:mm:ss (เขตเวลาของ spreadsheet) */
function formatDateTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

/** สร้าง response JSON พร้อม header ที่ถูกต้องสำหรับ doGet/doPost */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** สร้าง submission_id ใหม่ รูปแบบ sub_YYYYMMDDHHmmss_<community_key>_<เลขสุ่ม4หลัก> */
function generateSubmissionId(communityKey) {
  const now = new Date();
  const ts = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const rand = Math.floor(1000 + Math.random() * 9000);
  // ตัดอักขระที่อาจมีปัญหาออกจาก community_key (เผื่อมีช่องว่าง/วงเล็บ)
  const safeKey = String(communityKey).replace(/[^a-zA-Zก-๙0-9]/g, '');
  return 'sub_' + ts + '_' + safeKey + '_' + rand;
}

/**
 * *** ฟังก์ชันสำหรับรันมือครั้งเดียวจาก Apps Script editor เท่านั้น ***
 * ไม่เกี่ยวข้องกับ doGet/doPost — ไม่ถูกเรียกจากเว็บแอปที่ deploy ไว้เลย ปลอดภัยที่จะ
 * เก็บไว้ในไฟล์นี้ถาวร (ไม่มีผลกับพฤติกรรมเว็บแอป)
 *
 * แก้ปัญหาต้นตอที่ readSheetAsObjects() แค่ "ป้องกัน" ไว้ (แปลงค่า Date กลับเป็น string
 * ทุกครั้งที่อ่าน) — ฟังก์ชันนี้แก้ที่ตัวข้อมูลในชีตจริง ๆ ครั้งเดียว ทำให้คอลัมน์ "month"
 * กลับมาเป็น Plain text จริง ทั้ง format ของคอลัมน์และค่าที่เก็บไว้ในแต่ละเซลล์
 *
 * เหตุผลที่ต้องทำ 2 ขั้นตอน (ตั้ง format อย่างเดียวไม่พอ):
 * การเปลี่ยน Number format ของเซลล์ที่มีค่าเป็น Date อยู่แล้วเป็น "Plain text" จะแค่
 * เปลี่ยนการ "แสดงผล" ของค่าเดิม (อาจกลายเป็นเลข serial date แทน) ไม่ได้แปลงค่าที่เก็บ
 * จริงกลับเป็น "2026-04" ให้อัตโนมัติ ต้องเขียนค่า string ที่ถูกต้องทับลงไปด้วยตัวเอง
 * และต้องตั้ง format เป็น Plain text *ก่อน* เขียนทับ ไม่งั้น Sheets จะตีความ string ที่
 * เขียนกลับเป็น Date ซ้ำอีกครั้ง
 *
 * วิธีใช้: เปิดไฟล์นี้ใน Apps Script editor > เลือกฟังก์ชัน "fixAllMonthColumns" จาก
 * dropdown ด้านบน (ข้าง Run/Debug) > กด Run > อนุญาตสิทธิ์ถ้าถูกถาม > ดูผลที่
 * View > Logs (หรือ Ctrl+Enter) จะบอกจำนวนแถวที่แก้ในแต่ละชีต
 * ไม่ต้องสร้าง deployment version ใหม่สำหรับขั้นนี้ (ไม่กระทบเว็บแอปที่ deploy ไว้)
 * หลังรันแล้ว ความเร็วของหน้าเว็บที่ดึงข้อมูล monthly_records จะกลับมาเร็วเหมือนเดิม
 * เพราะ readSheetAsObjects() จะไม่ต้องเรียก Utilities.formatDate() ซ้ำทุกแถวอีกต่อไป
 * (เงื่อนไข instanceof Date จะเป็น false ตั้งแต่ต้น เพราะค่าเป็น string จริงแล้ว)
 */
function fixAllMonthColumns() {
  fixMonthColumnInSheet(SHEET_MONTHLY_RECORDS);
  fixMonthColumnInSheet(SHEET_MONTHLY_SUMMARY);
  fixMonthColumnInSheet(SHEET_PENDING_SUBMISSIONS);
}

/** แก้คอลัมน์ "month" ของชีตเดียว (เรียกจาก fixAllMonthColumns ไม่ต้องเรียกตรงเอง) */
function fixMonthColumnInSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ไม่พบชีตชื่อ: ' + sheetName);
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    Logger.log('ชีต "' + sheetName + '": ไม่มีข้อมูล ข้าม');
    return;
  }

  const headers = values[0];
  const monthColIndex = headers.indexOf('month');
  if (monthColIndex === -1) {
    throw new Error('ไม่พบคอลัมน์ "month" ในชีต: ' + sheetName);
  }

  const numRows = values.length - 1;
  const colRange = sheet.getRange(2, monthColIndex + 1, numRows, 1);

  // 1) ตั้ง format คอลัมน์เป็น Plain text ก่อน (เครื่องหมาย '@' คือโค้ด format
  //    ของ Plain text ใน Sheets API) ป้องกันไม่ให้ค่าที่กำลังจะเขียนทับถูกตีความเป็น
  //    Date ซ้ำอีก
  colRange.setNumberFormat('@');

  // 2) แปลงค่าที่ยังเป็น Date ให้เป็น string "yyyy-MM" แล้วเขียนทับทั้งคอลัมน์
  let fixedCount = 0;
  const fixedValues = [];
  for (let r = 1; r < values.length; r++) {
    let value = values[r][monthColIndex];
    if (value instanceof Date) {
      value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
      fixedCount += 1;
    }
    fixedValues.push([value]);
  }
  colRange.setValues(fixedValues);

  Logger.log(
    'ชีต "' + sheetName + '": แก้ไข ' + fixedCount + ' แถว จากทั้งหมด ' + numRows +
    ' แถว (แถวที่เหลือเป็น text ที่ถูกต้องอยู่แล้ว)'
  );
}

// ===== ส่วนคำนวณยอดรวมเข้า monthly_summary =====
// (เพิ่มเพราะพบว่า handleApproveSubmission() เดิม copy เข้า monthly_records อย่างเดียว
// ไม่เคยอัปเดต monthly_summary เลย ทำให้ dashboard ไม่เห็นยอดที่เพิ่งอนุมัติ)

// map ชื่อ field ภาษาไทยใน monthly_records ไปยังชื่อคอลัมน์ภาษาอังกฤษใน monthly_summary
const SUMMARY_FIELD_MAP = {
  'บริโภคในครัวเรือน': 'household_expense_reduction',
  'ขาย': 'sale',
  'แบ่งปัน': 'sharing',
  'ซื้อ': 'purchase',
  'ผลิตเอง': 'self_produced',
  'รับฟรี/อื่นๆ': 'free_other',
};
const SUMMARY_MEMBER_COUNT_COL = 'member_count_with_data';

/** รวมยอดและนับจำนวนแถว records ที่ส่งเข้ามา (pure function ใช้ร่วมกันทั้ง 2 ฟังก์ชันด้านล่าง) */
function aggregateRecords(records) {
  const sums = {};
  VALUE_FIELDS.forEach(function (f) { sums[f] = 0; });
  records.forEach(function (r) {
    VALUE_FIELDS.forEach(function (f) {
      sums[f] += Number(r[f]) || 0;
    });
  });
  return { count: records.length, sums: sums };
}

/**
 * คำนวณยอดรวมของ community_key+month หนึ่งคู่ใหม่จาก monthly_records ทั้งหมด (ไม่ใช่
 * แค่ submission ที่เพิ่งอนุมัติ กันกรณีมีหลาย submission ของเดือนเดียวกันถูกอนุมัติ
 * แยกครั้งกัน) แล้วเขียนทับแถวที่ตรงกันใน monthly_summary — ถ้าไม่เจอแถวเดิม (ไม่น่า
 * เกิดเพราะมี placeholder ไว้ล่วงหน้าทุกเดือนในปีงบ) จะเพิ่มแถวใหม่ต่อท้ายแทน
 *
 * เรียกจาก handleApproveSubmission() ทันทีหลัง copy เข้า monthly_records สำเร็จ
 */
function recalculateMonthlySummaryRow(communityKey, month) {
  const allRecords = readSheetAsObjects(SHEET_MONTHLY_RECORDS);
  const matching = allRecords.filter(function (r) {
    return r.community_key === communityKey && r.month === month;
  });
  const agg = aggregateRecords(matching);

  const sheet = getSpreadsheet().getSheetByName(SHEET_MONTHLY_SUMMARY);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = {};
  headers.forEach(function (h, i) { colIndex[h] = i; });

  let targetRow = -1; // เลขแถวจริงใน sheet (1-indexed, นับ header เป็นแถว 1)
  for (let r = 1; r < values.length; r++) {
    let rowMonth = values[r][colIndex['month']];
    if (rowMonth instanceof Date) {
      rowMonth = Utilities.formatDate(rowMonth, Session.getScriptTimeZone(), 'yyyy-MM');
    }
    if (values[r][colIndex['community_key']] === communityKey && rowMonth === month) {
      targetRow = r + 1;
      break;
    }
  }

  const rowData = {};
  rowData['community_key'] = communityKey;
  rowData['month'] = month;
  rowData[SUMMARY_MEMBER_COUNT_COL] = agg.count;
  VALUE_FIELDS.forEach(function (f) {
    rowData[SUMMARY_FIELD_MAP[f]] = agg.sums[f];
  });

  if (targetRow === -1) {
    const newRowValues = headers.map(function (h) {
      return rowData[h] !== undefined ? rowData[h] : '';
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([newRowValues]);
  } else {
    Object.keys(rowData).forEach(function (col) {
      if (colIndex[col] === undefined) return;
      sheet.getRange(targetRow, colIndex[col] + 1).setValue(rowData[col]);
    });
  }
}

/**
 * *** ฟังก์ชันสำหรับรันมือครั้งเดียวจาก Apps Script editor เท่านั้น ***
 * ไม่เกี่ยวข้องกับ doGet/doPost — แก้ปัญหาย้อนหลังของทุก submission ที่เคยอนุมัติผ่าน
 * dashboard มาก่อนบั๊กนี้ถูกแก้ (monthly_summary ไม่เคยถูกอัปเดตมาก่อนเลย) — วนคำนวณ
 * ทุกคู่ community_key+month ที่ปรากฏใน monthly_records ใหม่ทั้งหมดในครั้งเดียว แล้ว
 * เขียนทับ monthly_summary ให้ตรงกัน (เขียนเป็น batch เดียว ไม่ใช่ทีละเซลล์ เพื่อไม่ให้
 * ช้าเกินไปกับข้อมูล 85 ชุมชน x 4 ปีงบ)
 *
 * วิธีใช้: เปิดไฟล์นี้ใน Apps Script editor > เลือก "rebuildAllMonthlySummary" จาก
 * dropdown ด้านบน > Run > อนุญาตสิทธิ์ถ้าถูกถาม > ดูผลที่ View > Logs
 */
function rebuildAllMonthlySummary() {
  const allRecords = readSheetAsObjects(SHEET_MONTHLY_RECORDS);

  const aggregated = {}; // key = community_key+'|'+month
  allRecords.forEach(function (r) {
    const key = r.community_key + '|' + r.month;
    if (!aggregated[key]) {
      aggregated[key] = { community_key: r.community_key, month: r.month, records: [] };
    }
    aggregated[key].records.push(r);
  });

  const sheet = getSpreadsheet().getSheetByName(SHEET_MONTHLY_SUMMARY);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = {};
  headers.forEach(function (h, i) { colIndex[h] = i; });

  const existingRowIndex = {};
  for (let r = 1; r < values.length; r++) {
    let rowMonth = values[r][colIndex['month']];
    if (rowMonth instanceof Date) {
      rowMonth = Utilities.formatDate(rowMonth, Session.getScriptTimeZone(), 'yyyy-MM');
    }
    existingRowIndex[values[r][colIndex['community_key']] + '|' + rowMonth] = r;
  }

  let updated = 0;
  const newRows = [];
  Object.keys(aggregated).forEach(function (key) {
    const group = aggregated[key];
    const agg = aggregateRecords(group.records);
    const rowData = {};
    rowData['community_key'] = group.community_key;
    rowData['month'] = group.month;
    rowData[SUMMARY_MEMBER_COUNT_COL] = agg.count;
    VALUE_FIELDS.forEach(function (f) {
      rowData[SUMMARY_FIELD_MAP[f]] = agg.sums[f];
    });

    if (existingRowIndex[key] !== undefined) {
      const r = existingRowIndex[key];
      Object.keys(rowData).forEach(function (col) {
        if (colIndex[col] === undefined) return;
        values[r][colIndex[col]] = rowData[col];
      });
      updated += 1;
    } else {
      newRows.push(headers.map(function (h) {
        return rowData[h] !== undefined ? rowData[h] : '';
      }));
    }
  });

  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  Logger.log('อัปเดตแถวเดิม ' + updated + ' แถว, เพิ่มแถวใหม่ ' + newRows.length + ' แถว');
}