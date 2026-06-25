// src/pages/fiscalYears.js
//
// ค่าคงที่และฟังก์ชันเกี่ยวกับปีงบประมาณ ใช้ร่วมกันทั้งหน้าแรกและหน้ารายชุมชน

export const FISCAL_YEAR_RANGES = {
  '2565': { start: '2021-10', end: '2022-09' },
  '65-66': { start: '2022-10', end: '2023-09' },
  '67-68': { start: '2024-10', end: '2025-09' },
  '68-69': { start: '2025-10', end: '2026-09' },
};

// เรียงจากเก่าไปใหม่ ใช้ตอนหาปีก่อนหน้า/ปีล่าสุดที่มีข้อมูลครบ
export const FISCAL_YEAR_ORDER = ['2565', '65-66', '67-68', '68-69'];

export function enumerateMonths(startMonth, endMonth) {
  const result = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [endY, endM] = endMonth.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return result;
}

const THAI_MONTH_ABBR = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function formatMonthLabel(monthStr) {
  const m = Number(monthStr.split('-')[1]);
  return THAI_MONTH_ABBR[m];
}

export const FISCAL_YEAR_DISPLAY_LABEL = {
  '2565': 'ปีงบ 2565',
  '65-66': 'ปีงบ 65–66',
  '67-68': 'ปีงบ 67–68',
  '68-69': 'ปีงบ 68–69',
};

/** "2025-10" -> "ต.ค.68" (เดือนย่อ + ปี พ.ศ. 2 หลักท้าย) ใช้สร้าง label ช่วงปีงบอัตโนมัติ */
export function toShortThaiLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const beShort = String((y + 543) % 100).padStart(2, '0');
  return `${THAI_MONTH_ABBR[m]}${beShort}`;
}

/**
 * จุดเดียวที่สร้างตัวเลือกปีงบสำหรับ dropdown ทุกหน้า (FilterBar, CommunityHeader, ...)
 * label ส่วน "(ต.ค.68–ก.ย.69)" คำนวณจาก FISCAL_YEAR_RANGES โดยตรง ไม่ได้พิมพ์มือแยกไว้
 * คนละที่ — เวลาขึ้นปีงบใหม่ แค่เพิ่ม key ใหม่ใน FISCAL_YEAR_RANGES + FISCAL_YEAR_ORDER
 * + FISCAL_YEAR_DISPLAY_LABEL ที่ไฟล์นี้ไฟล์เดียว ทุกหน้าที่ import จากที่นี่จะได้
 * ตัวเลือกใหม่ทันทีโดยไม่ต้องไปแก้ที่อื่นอีก
 */
export function buildFiscalYearDropdownOptions({ includeAll = false } = {}) {
  const options = [...FISCAL_YEAR_ORDER].reverse().map((key) => {
    const range = FISCAL_YEAR_RANGES[key];
    const rangeLabel = `(${toShortThaiLabel(range.start)}–${toShortThaiLabel(range.end)})`;
    return { value: key, label: `${FISCAL_YEAR_DISPLAY_LABEL[key]} ${rangeLabel}` };
  });
  if (includeAll) {
    options.push({ value: 'all', label: `ทุกปี (รวม ${FISCAL_YEAR_ORDER.length} ปีงบ)` });
  }
  return options;
}

/**
 * คืน true ถ้าชุมชนนี้มีข้อมูลครบทุกเดือน (12 เดือน) ในปีงบที่ระบุ
 * ใช้ตัดสินว่าจะใช้ปีนี้คำนวณสถิติที่ต้องอิงข้อมูลครบปี (เช่น สถิติตามฤดูกาล)
 * ได้หรือไม่ — ถ้าใช้ปีที่ข้อมูลไม่ครบ ผลลัพธ์จะคลาดเคลื่อน
 */
export function isFiscalYearComplete(summaryRowsForCommunity, fiscalYearKey) {
  const range = FISCAL_YEAR_RANGES[fiscalYearKey];
  if (!range) return false;
  const expectedMonths = enumerateMonths(range.start, range.end);
  const presentMonths = new Set(summaryRowsForCommunity.map((r) => r.month));
  return expectedMonths.every((m) => presentMonths.has(m));
}

/** หาปีงบล่าสุดที่มีข้อมูลครบ 12 เดือนสำหรับชุมชนนี้ ไล่จากปีล่าสุดย้อนกลับ */
export function findLatestCompleteFiscalYear(summaryRowsForCommunity) {
  for (let i = FISCAL_YEAR_ORDER.length - 1; i >= 0; i -= 1) {
    const key = FISCAL_YEAR_ORDER[i];
    if (isFiscalYearComplete(summaryRowsForCommunity, key)) {
      return key;
    }
  }
  return null;
}

/** คืน fiscal year key ก่อนหน้า key ที่ระบุ ตามลำดับ FISCAL_YEAR_ORDER หรือ null ถ้าไม่มี */
export function getPreviousFiscalYear(fiscalYearKey) {
  const idx = FISCAL_YEAR_ORDER.indexOf(fiscalYearKey);
  if (idx <= 0) return null;
  return FISCAL_YEAR_ORDER[idx - 1];
}

// --- รองรับ "ปีปฏิทิน" เป็นมุมมองที่สองเทียบเท่าปีงบประมาณ (เหมือนหน้าแรก) ---
// เรียงใหม่ -> เก่า ตรงกับลำดับที่ใช้แสดงใน dropdown ปีปฏิทินของหน้าแรก
export const CALENDAR_YEAR_LIST = ['2026', '2025', '2024', '2023', '2022', '2021'];

export function buildCalendarYearDropdownOptions() {
  return CALENDAR_YEAR_LIST.map((y) => ({ value: y, label: `ปี ${y}` }));
}

/**
 * แปลง (yearType, year) ให้เป็นช่วงเดือนจริง {start, end} เสมอ ไม่ว่าจะเป็นปีงบ
 * หรือปีปฏิทิน — จุดเดียวที่ต้องรู้ว่า "ปี" แต่ละแบบหมายถึงช่วงเดือนไหนจริง ๆ
 * ฟังก์ชันคำนวณอื่น ๆ ทั้งหมด (ใน communityAggregations.js) ทำงานกับ {start,end}
 * ตรง ๆ ไม่ต้องรู้ว่ามาจากปีงบหรือปีปฏิทิน
 */
export function getPeriodRange(yearType, year) {
  if (yearType === 'calendar') {
    return { start: `${year}-01`, end: `${year}-12` };
  }
  return FISCAL_YEAR_RANGES[year] || null;
}

/** ป้ายข้อความของช่วงที่เลือก เช่น "ปีงบ 68–69" หรือ "ปี 2026" */
export function getPeriodDisplayLabel(yearType, year) {
  if (yearType === 'calendar') return `ปี ${year}`;
  return FISCAL_YEAR_DISPLAY_LABEL[year] || `ปีงบ ${year}`;
}

/** คืนค่า "ปี" ก่อนหน้า (fiscal key หรือ calendar year string ตาม yearType) หรือ null ถ้าไม่มี */
export function getPreviousPeriod(yearType, year) {
  if (yearType === 'calendar') {
    const idx = CALENDAR_YEAR_LIST.indexOf(year);
    // CALENDAR_YEAR_LIST เรียงใหม่ -> เก่า ดังนั้นปีก่อนหน้าคือ index ถัดไป (ไม่ใช่ก่อนหน้า)
    if (idx < 0 || idx >= CALENDAR_YEAR_LIST.length - 1) return null;
    return CALENDAR_YEAR_LIST[idx + 1];
  }
  return getPreviousFiscalYear(year);
}

/** คืน true ถ้ามีข้อมูลครบทุกเดือนในช่วง {start,end} ที่ระบุ (ใช้ได้ทั้งปีงบและปีปฏิทิน) */
export function isRangeComplete(summaryRowsForCommunity, range) {
  if (!range) return false;
  const expectedMonths = enumerateMonths(range.start, range.end);
  const presentMonths = new Set(summaryRowsForCommunity.map((r) => r.month));
  return expectedMonths.every((m) => presentMonths.has(m));
}

/** จำนวนเดือนที่มีข้อมูลจริงในช่วง {start,end} จากที่ควรมีทั้งหมด (สำหรับข้อความเตือน) */
export function countMonthsWithData(summaryRowsForCommunity, range) {
  if (!range) return { present: 0, expected: 0 };
  const expectedMonths = enumerateMonths(range.start, range.end);
  const presentMonths = new Set(summaryRowsForCommunity.map((r) => r.month));
  const present = expectedMonths.filter((m) => presentMonths.has(m)).length;
  return { present, expected: expectedMonths.length };
}

/**
 * ย่อช่วงปีงบ/ปีปฏิทินเต็ม ๆ ให้เหลือแค่ช่วงเดือนย่อยที่เลือก (เช่น "ธ.ค. ถึง มี.ค." ภายใน
 * ปีงบ 68–69) — รับเลขเดือน (เช่น "12", "03") ไม่ใช่ YYYY-MM ตรง ๆ เพราะผู้ใช้เลือกจาก
 * dropdown เดือนของปีนั้น ๆ ซึ่งไม่รู้ปี ค.ศ. ล่วงหน้า
 *
 * ต้องคำนวณจากลำดับเดือนจริงของปีนั้น (ดู enumerateMonths) ไม่ใช่เทียบเลขเดือน 01-12
 * ตรง ๆ เพราะปีงบเริ่ม ต.ค. ทำให้ลำดับเดือนไม่ใช่ 01->12 แต่เป็น 10,11,12,01,...,09 —
 * ถ้าเทียบเลขตรง ๆ "ธ.ค.(12) ถึง มี.ค.(03)" จะดูเหมือนเดือนสิ้นสุดมาก่อนเดือนเริ่ม ทั้งที่
 * จริง ๆ แล้ว ธ.ค. มาก่อน มี.ค. ในปีงบเดียวกัน
 *
 * คืน {start, end} แบบ YYYY-MM หรือ null ถ้าเลือกไม่ถูกต้อง (เดือนเริ่มมาหลังเดือนสิ้นสุด
 * ในลำดับของปีนั้น หรือหาเดือนที่เลือกไม่เจอในปีนั้นเลย)
 */
export function narrowRangeByMonths(yearRange, monthFromNum, monthToNum) {
  if (!yearRange) return null;
  const allMonths = enumerateMonths(yearRange.start, yearRange.end);
  const fromIndex = allMonths.findIndex((m) => m.split('-')[1] === monthFromNum);
  const toIndex = allMonths.findIndex((m) => m.split('-')[1] === monthToNum);
  if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) return null;
  return { start: allMonths[fromIndex], end: allMonths[toIndex] };
}

/**
 * สร้างตัวเลือกเดือนสำหรับ dropdown "จากเดือน"/"ถึงเดือน" เรียงตามลำดับจริงของปีประเภท
 * นั้น (ปีงบ: ต.ค.->ก.ย., ปีปฏิทิน: ม.ค.->ธ.ค.) ไม่ใช่เรียงเลข 01->12 เสมอ
 */
export function buildMonthOfYearOptions(yearType) {
  const sampleRange = yearType === 'calendar' ? { start: '2000-01', end: '2000-12' } : FISCAL_YEAR_RANGES['68-69'];
  return enumerateMonths(sampleRange.start, sampleRange.end).map((m) => {
    const monthNum = m.split('-')[1];
    return { value: monthNum, label: formatMonthLabel(m) };
  });
}

/**
 * ป้ายข้อความสำหรับช่วงที่กำลังดูจริง — ถ้า range ที่ส่งมาคือทั้งปี (เท่ากับ fullYearRange)
 * ใช้ป้ายปีตามปกติ (เช่น "ปีงบ 68–69") แต่ถ้าเป็นช่วงเดือนย่อยที่ผู้ใช้กรองไว้ ใช้ป้าย
 * ช่วงเดือนแทน (เช่น "ธ.ค.68 – มี.ค.69") ให้เห็นชัดว่ากำลังดูแค่บางเดือน ไม่ใช่ทั้งปี
 */
export function formatPeriodOrRangeLabel(yearType, year, range, fullYearRange) {
  const isFullYear = fullYearRange && range.start === fullYearRange.start && range.end === fullYearRange.end;
  if (isFullYear) return getPeriodDisplayLabel(yearType, year);
  return `${toShortThaiLabel(range.start)} – ${toShortThaiLabel(range.end)}`;
}
