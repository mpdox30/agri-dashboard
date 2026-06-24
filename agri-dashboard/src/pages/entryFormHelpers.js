// src/pages/entryFormHelpers.js
//
// ฟังก์ชันคำนวณล้วน ๆ สำหรับหน้ากรอกข้อมูล แยกจาก React เพื่อให้ทดสอบง่าย

export const VALUE_FIELDS = ['ขาย', 'ซื้อ', 'แบ่งปัน', 'บริโภคในครัวเรือน', 'ผลิตเอง', 'รับฟรี/อื่นๆ'];

const THAI_MONTH_FULL_ABBR = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** แปลง YYYY-MM เป็นข้อความ "เม.ย. 2569" (ปี พ.ศ.) */
export function formatMonthWithBuddhistYear(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const buddhistYear = y + 543;
  return `${THAI_MONTH_FULL_ABBR[m]} ${buddhistYear}`;
}

/** คืนเดือนก่อนหน้าในรูปแบบ YYYY-MM — ตรรกะเดียวกับฝั่ง backend (ApprovalApi.gs) */
export function getPreviousMonth(monthStr) {
  let [year, month] = monthStr.split('-').map(Number);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** เพิ่ม n เดือนจาก monthStr (n เป็นลบได้เพื่อย้อนกลับ) */
function addMonths(monthStr, n) {
  let [year, month] = monthStr.split('-').map(Number);
  month += n;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * สร้างรายการเดือนล่าสุด count เดือน (รวมเดือนปัจจุบัน) ให้เลือกในฟอร์มกรอกข้อมูล
 * จำกัดไว้ไม่ให้เลือกเดือนเก่ามาก ๆ เพราะระบบนี้ใช้กรอกข้อมูลรายเดือนตามรอบจริง
 */
export function generateRecentMonthOptions(currentMonthStr, count = 6) {
  const options = [];
  for (let i = 0; i < count; i += 1) {
    options.push(addMonths(currentMonthStr, -i));
  }
  return options;
}

/**
 * สร้างรายชื่อสมาชิกทั้งหมดของชุมชน (จาก monthly_records ทุกเดือนที่เคยมี) พร้อมค่า
 * เดือนก่อนหน้า (เทียบกับ targetMonth) ของแต่ละคน ถ้ามี
 *
 * คืน [{ fullName, joinYear, previousValues: {field:number} | null }]
 * เรียงตามชื่อ (จะ sort ใหม่ตามที่ต้องการได้ใน component)
 */
export function buildMemberRoster(monthlyRecordsForCommunity, targetMonth) {
  const previousMonth = getPreviousMonth(targetMonth);

  // หาชื่อสมาชิกทั้งหมดที่เคยมีในข้อมูล (ไม่จำกัดเฉพาะเดือนใดเดือนหนึ่ง เพราะสมาชิก
  // บางคนอาจไม่ได้กรอกทุกเดือน แต่ยังถือเป็นสมาชิกของชุมชนอยู่)
  const byName = new Map();
  monthlyRecordsForCommunity.forEach((r) => {
    if (!byName.has(r.full_name)) {
      byName.set(r.full_name, { fullName: r.full_name, joinYear: r.join_year });
    } else {
      // ใช้ join_year จากแถวล่าสุดที่เจอ (เผื่อมีการแก้ไขปีที่เข้าร่วมย้อนหลัง)
      const existing = byName.get(r.full_name);
      if (r.month > (existing.lastSeenMonth || '')) {
        existing.joinYear = r.join_year;
        existing.lastSeenMonth = r.month;
      }
    }
  });

  const previousRowsByName = new Map();
  monthlyRecordsForCommunity
    .filter((r) => r.month === previousMonth)
    .forEach((r) => {
      const values = {};
      VALUE_FIELDS.forEach((f) => {
        values[f] = Number(r[f]) || 0;
      });
      previousRowsByName.set(r.full_name, values);
    });

  return Array.from(byName.values())
    .map((m) => ({
      fullName: m.fullName,
      joinYear: m.joinYear,
      previousValues: previousRowsByName.get(m.fullName) || null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'th'));
}

/** คืน true ถ้าแถวนี้มีการกรอกข้อมูลแล้วอย่างน้อย 1 ช่อง (ค่าเป็น string ที่ไม่ว่าง) */
export function isRowTouched(currentValues) {
  return VALUE_FIELDS.some((f) => currentValues[f] !== undefined && currentValues[f] !== '');
}

/** รายได้สุทธิของแถว = ขาย − ซื้อ + แบ่งปัน (ใช้นิยามเดียวกันทั้งระบบ) */
export function computeRowTotal(currentValues) {
  const sale = Number(currentValues['ขาย']) || 0;
  const purchase = Number(currentValues['ซื้อ']) || 0;
  const sharing = Number(currentValues['แบ่งปัน']) || 0;
  return sale - purchase + sharing;
}

/**
 * เทียบแต่ละช่องของแถวนี้กับเดือนก่อน (ถ้ามี) — ตรรกะเดียวกับ ApprovalApi.gs
 * computeAnomalyFlags เป๊ะ ๆ เพื่อให้ flag ที่เห็นตอนกรอกตรงกับที่ทีมกลางจะเห็นตอน
 * ตรวจสอบ ไม่ใช่กฎคนละชุดที่อาจขัดแย้งกัน
 * คืน array ของชื่อช่องที่ผิดปกติ (เกิน ±300% จากเดือนก่อน)
 */
export function computeRowFlags(currentValues, previousValues) {
  if (!previousValues) return [];
  const THRESHOLD = 3.0;
  const flags = [];
  VALUE_FIELDS.forEach((field) => {
    if (currentValues[field] === undefined || currentValues[field] === '') return; // ยังไม่กรอกช่องนี้ ไม่เทียบ
    const curr = Number(currentValues[field]) || 0;
    const prev = Number(previousValues[field]) || 0;
    if (prev === 0 && curr === 0) return;
    if (prev === 0 && curr > 0) {
      flags.push(field);
      return;
    }
    const changeRatio = Math.abs(curr - prev) / prev;
    if (changeRatio > THRESHOLD) {
      flags.push(field);
    }
  });
  return flags;
}

/** Levenshtein distance ธรรมดา ใช้คำนวณความคล้ายของชื่อ (ไม่ต้องพึ่ง library ภายนอก) */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** คะแนนความคล้าย 0-1 (1 = เหมือนกันเป๊ะ) จาก Levenshtein distance เทียบความยาวสตริง */
export function nameSimilarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * เช็คว่าชื่อที่กำลังพิมพ์ (เช่น ตอนกด "เพิ่มสมาชิกใหม่") คล้ายกับชื่อที่มีอยู่แล้วใน
 * รายชื่อสมาชิกของชุมชนนี้หรือไม่ (เกณฑ์เดียวกับที่ใช้สแกนทั้งระบบ — ดู
 * near_duplicate_names.csv) เพื่อเตือนก่อนกดส่ง ป้องกันไม่ให้เกิดชื่อซ้ำใหม่เพิ่มขึ้นอีก
 * จากการพิมพ์ผิด/สะกดไม่ตรงกัน — คืนชื่อที่คล้ายที่สุดถ้าเกินเกณฑ์ หรือ null ถ้าไม่เจอ
 */
export function findSimilarExistingName(typedName, existingNames, threshold = 0.82) {
  const trimmed = typedName.trim();
  if (trimmed.length === 0) return null;
  let bestMatch = null;
  let bestScore = 0;
  existingNames.forEach((name) => {
    if (name === trimmed) return; // เหมือนเป๊ะคือชื่อเดิมอยู่แล้ว ไม่ใช่ "คล้าย"
    const score = nameSimilarity(trimmed, name);
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  });
  return bestMatch;
}
