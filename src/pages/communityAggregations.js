// src/pages/communityAggregations.js
//
// ฟังก์ชันคำนวณสำหรับหน้า "รายชุมชน (ภายใน)" แยกจาก React component ทั้งหมด
// เพื่อให้ทดสอบและตรวจสอบความถูกต้องของตรรกะได้ง่าย
//
// ทุกฟังก์ชันรับ "range" เป็น {start, end} (YYYY-MM ทั้งคู่) ตรง ๆ ไม่ใช่ fiscal year
// key — เพื่อให้ใช้ได้ทั้งโหมดปีงบประมาณและปีปฏิทิน (ดู getPeriodRange ใน fiscalYears.js
// ซึ่งเป็นจุดเดียวที่รู้ว่า "ปี" แต่ละแบบแปลว่าช่วงเดือนไหนจริง ๆ)

import { FISCAL_YEAR_RANGES, FISCAL_YEAR_ORDER, enumerateMonths, formatMonthLabel, getPreviousFiscalYear } from './fiscalYears';

/** รวมยอด sale/purchase/sharing/household_reduction จาก summary rows ของช่วงเดือนเดียว */
export function sumRangeTotals(summaryRowsForCommunity, range) {
  if (!range) return null;
  const rows = summaryRowsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );
  const totals = rows.reduce(
    (acc, r) => {
      acc.sale += Number(r.sale) || 0;
      acc.purchase += Number(r.purchase) || 0;
      acc.sharing += Number(r.sharing) || 0;
      acc.householdReduction += Number(r.household_expense_reduction) || 0;
      return acc;
    },
    { sale: 0, purchase: 0, sharing: 0, householdReduction: 0 }
  );
  return {
    ...totals,
    netIncome: totals.sale - totals.purchase + totals.sharing,
    monthsWithData: rows.length,
  };
}

function isZeroSummaryRow(r) {
  return (
    (Number(r.sale) || 0) === 0 &&
    (Number(r.purchase) || 0) === 0 &&
    (Number(r.sharing) || 0) === 0 &&
    (Number(r.household_expense_reduction) || 0) === 0
  );
}

function isNextCalendarMonth(monthA, monthB) {
  let [y, m] = monthA.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}` === monthB;
}

/**
 * หาเดือนที่ "มีแถวข้อมูลอยู่จริง แต่ทุกยอดเป็น 0 ทั้งหมด" และเป็นส่วนหนึ่งของช่วงที่
 * ติดกันทางปฏิทิน (ไม่มีช่องว่าง) ยาวตั้งแต่ minRunLength เดือนขึ้นไป — ตอบคำถามว่า
 * "ครบแต่ไม่มีรายได้" ควรถือเป็น "ไม่มีข้อมูล" หรือไม่: ถ้าเป็น 0 ต่อเนื่องยาวขนาดนี้
 * ให้ถือว่าเทียบเท่ากับไม่ได้กรอกข้อมูลจริง (เกณฑ์เริ่มต้น 4 เดือนติดกัน ตามที่ตกลงกัน
 * — 0 สั้น ๆ 1-3 เดือนยังถือเป็นไปได้ว่าเป็นข้อมูลจริง เช่น เดือนที่ไม่มีกิจกรรมจริง ๆ
 * แต่ยาวต่อเนื่องนานกว่านั้นไม่น่าใช่ของจริง)
 * คืน Set ของเดือน (string "YYYY-MM") ที่ควรปลดออกจากการนับว่า "มีข้อมูล"
 */
export function findLikelyUnenteredMonths(summaryRowsForCommunity, minRunLength = 4) {
  const sorted = [...summaryRowsForCommunity].sort((a, b) => a.month.localeCompare(b.month));
  const toExclude = new Set();
  let i = 0;
  while (i < sorted.length) {
    if (!isZeroSummaryRow(sorted[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < sorted.length &&
      isZeroSummaryRow(sorted[j + 1]) &&
      isNextCalendarMonth(sorted[j].month, sorted[j + 1].month)
    ) {
      j += 1;
    }
    if (j - i + 1 >= minRunLength) {
      for (let k = i; k <= j; k += 1) toExclude.add(sorted[k].month);
    }
    i = j + 1;
  }
  return toExclude;
}

/**
 * คืนชุดข้อมูล summary rows ของชุมชนเดียว ที่ตัดเดือนซึ่งน่าจะไม่ได้กรอกข้อมูลจริงออกแล้ว
 * (ดู findLikelyUnenteredMonths) — ใช้แทนข้อมูลดิบทุกจุดที่ต้องคำนวณความครบถ้วน/ยอดรวม
 * เพื่อให้ทั้งระบบเห็นภาพตรงกัน ไม่ใช่จุดหนึ่งบอก "ครบ" อีกจุดบอก "ไม่มีข้อมูล"
 */
export function excludeLikelyUnenteredMonths(summaryRowsForCommunity, minRunLength = 4) {
  const excluded = findLikelyUnenteredMonths(summaryRowsForCommunity, minRunLength);
  if (excluded.size === 0) return summaryRowsForCommunity;
  return summaryRowsForCommunity.filter((r) => !excluded.has(r.month));
}

/**
 * ทำความสะอาด monthly_summary ของทุกชุมชนพร้อมกัน (จัดกลุ่มตาม community_key ก่อน แล้ว
 * เรียก excludeLikelyUnenteredMonths ของแต่ละชุมชนแยกกัน เพราะ "ช่วงต่อเนื่อง" ต้องนับ
 * เฉพาะภายในชุมชนเดียวกัน) ใช้ผลลัพธ์นี้แทน allSummaryRows ดิบทุกจุด ทั้งของชุมชนที่
 * เลือกดูอยู่และของชุมชนอื่นที่ใช้เทียบในแท็บเปรียบเทียบ เพื่อให้การจัดอันดับยุติธรรม
 * เท่ากันทุกชุมชน ไม่ใช่แค่ชุมชนที่กำลังดูอยู่
 */
export function cleanAllSummaryRows(allSummaryRows, minRunLength = 4) {
  const byComm = new Map();
  allSummaryRows.forEach((r) => {
    if (!byComm.has(r.community_key)) byComm.set(r.community_key, []);
    byComm.get(r.community_key).push(r);
  });
  const cleaned = [];
  byComm.forEach((rows) => {
    cleaned.push(...excludeLikelyUnenteredMonths(rows, minRunLength));
  });
  return cleaned;
}

/** คำนวณ % เปลี่ยนแปลงจาก previous ไป current หรือ null ถ้าคำนวณไม่ได้ (previous=0 หรือไม่มีข้อมูล) */
export function percentChange(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * ข้อมูลสำหรับกราฟแนวโน้ม 4 ปีงบประมาณจริงของชุมชนเดียว (แท็บภาพรวม)
 * แสดงเสมอเป็น 4 ปีงบจริงตามปฏิทินงบประมาณ ไม่เปลี่ยนตามโหมดปีงบ/ปีปฏิทินที่เลือกไว้
 * ด้านบน เพราะเป็นภาพรวมประวัติทั้งหมด ไม่ใช่ "ข้อมูลของช่วงที่เลือกดู"
 * คืน { yearKey, totals, previousTotals }[] เรียงตาม FISCAL_YEAR_ORDER
 */
export function buildFourYearTrend(summaryRowsForCommunity) {
  return FISCAL_YEAR_ORDER.map((yearKey) => {
    const totals = sumRangeTotals(summaryRowsForCommunity, FISCAL_YEAR_RANGES[yearKey]);
    const prevKey = getPreviousFiscalYear(yearKey);
    const previousTotals = prevKey ? sumRangeTotals(summaryRowsForCommunity, FISCAL_YEAR_RANGES[prevKey]) : null;
    return { yearKey, totals, previousTotals };
  });
}

// --- แท็บ "วิเคราะห์เชิงลึก" ---

// นิยามฤดูตามภูมิอากาศไทยทั่วไป: ฤดูฝนกลางเดือนพฤษภาคม-ตุลาคม, ฤดูแล้ง/หนาว
// พฤศจิกายน-เมษายน (ใช้เดือนเต็มเพื่อความง่าย ไม่ตัดครึ่งเดือน)
const RAINY_MONTHS = new Set([5, 6, 7, 8, 9, 10]);

function monthNumberOf(monthStr) {
  return Number(monthStr.split('-')[1]);
}

/** แยกรายได้สุทธิตามฤดูฝน/แล้ง สำหรับช่วงเดือนที่ระบุ (ทำงานได้แม้ข้อมูลไม่ครบ — เดือนที่ไม่มีข้อมูลนับเป็น 0) */
export function buildSeasonalBreakdown(summaryRowsForCommunity, range) {
  if (!range) return null;
  const rows = summaryRowsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );

  let rainyTotal = 0;
  let dryTotal = 0;
  const monthly = enumerateMonths(range.start, range.end).map((m) => {
    const row = rows.find((r) => r.month === m);
    const netIncome = row
      ? (Number(row.sale) || 0) - (Number(row.purchase) || 0) + (Number(row.sharing) || 0)
      : 0;
    const isRainy = RAINY_MONTHS.has(monthNumberOf(m));
    if (isRainy) rainyTotal += netIncome;
    else dryTotal += netIncome;
    return { label: formatMonthLabel(m), netIncome, isRainy };
  });

  const grandTotal = rainyTotal + dryTotal;
  return {
    rainyTotal,
    dryTotal,
    rainyPct: grandTotal !== 0 ? (rainyTotal / grandTotal) * 100 : 0,
    dryPct: grandTotal !== 0 ? (dryTotal / grandTotal) * 100 : 0,
    monthly,
  };
}

/**
 * องค์ประกอบของ "รายได้สุทธิ" (ขาย + แบ่งปัน หักด้วยซื้อ) ของช่วงเดือนที่ระบุ
 *
 * หมายเหตุสำคัญ: % ในที่นี้คำนวณจากฐาน (ขาย + แบ่งปัน) เท่านั้น เพราะเป็น 2 รายการที่
 * เป็นองค์ประกอบบวกจริงของสมการ "รายได้สุทธิ = ขาย + แบ่งปัน − ซื้อ" — ซื้อ ไม่ได้รวม
 * อยู่ในฐาน % เพราะเป็นรายการที่ถูกหักออก ไม่ใช่ส่วนประกอบที่บวกเข้าไป (ถ้ารวมซื้อเข้า
 * ฐานเหมือนเป็นรายการบวก ตัวเลข % ที่ได้จะตีความผิดและบวกกันได้ไม่ตรงกับรายได้สุทธิจริง
 * ที่โชว์ใน KPI ด้านบน) ส่วน "ลดรายจ่ายครัวเรือน" ไม่รวมอยู่ในฟังก์ชันนี้เลย เพราะไม่ใช่
 * ส่วนหนึ่งของสมการรายได้สุทธิ — เป็นตัวชี้วัดคนละตัวที่แสดงแยกเป็นการ์ดของตัวเองอยู่แล้ว
 * ในหน้า KPI ด้านบน
 */
export function buildIncomeComposition(summaryRowsForCommunity, range) {
  const totals = sumRangeTotals(summaryRowsForCommunity, range);
  if (!totals) return null;
  const grossPositive = totals.sale + totals.sharing;
  const pct = (v) => (grossPositive !== 0 ? (v / grossPositive) * 100 : 0);
  return {
    sale: totals.sale,
    purchase: totals.purchase,
    sharing: totals.sharing,
    householdReduction: totals.householdReduction,
    netIncome: totals.netIncome, // = sale + sharing - purchase เสมอ ตรงกับ KPI ด้านบนแบบตรวจสอบได้
    salePct: pct(totals.sale),
    sharingPct: pct(totals.sharing),
    // % ของซื้อ เทียบฐานเดียวกัน (ขาย+แบ่งปัน) เพื่อให้เห็นสัดส่วนการหักออกเทียบรายได้
    // ขาเข้า แต่ไม่ได้รวมอยู่ใน salePct/sharingPct เพื่อไม่ให้ดูเหมือนเป็นรายการบวก
    purchasePctOfGross: pct(totals.purchase),
  };
}

/**
 * สถิติความเหลื่อมล้ำรายได้ระหว่างสมาชิกในช่วงเดือนที่ระบุ จาก monthly_records รายคน
 * รายได้ต่อคน = ขาย - ซื้อ + แบ่งปัน รวมทั้งช่วง
 */
export function buildMemberIncomeStats(monthlyRecordsForCommunity, range) {
  if (!range) return null;
  const rows = monthlyRecordsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );

  const byMember = new Map(); // full_name -> { netIncome, joinYear }
  rows.forEach((r) => {
    const net =
      (Number(r['ขาย']) || 0) - (Number(r['ซื้อ']) || 0) + (Number(r['แบ่งปัน']) || 0);
    const existing = byMember.get(r.full_name) || { netIncome: 0, joinYear: r.join_year };
    existing.netIncome += net;
    byMember.set(r.full_name, existing);
  });

  const members = Array.from(byMember.entries()).map(([fullName, data]) => ({
    fullName,
    joinYear: data.joinYear,
    netIncome: data.netIncome,
  }));
  members.sort((a, b) => b.netIncome - a.netIncome);

  const incomes = members.map((m) => m.netIncome);
  const n = incomes.length;
  if (n === 0) {
    return { members: [], mean: 0, median: 0, max: 0, min: 0, top10PctShare: 0, topCount: 0 };
  }

  const sum = incomes.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const sorted = [...incomes].sort((a, b) => a - b);
  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];

  const topCount = Math.max(1, Math.round(n * 0.1));
  const topSum = members.slice(0, topCount).reduce((a, m) => a + m.netIncome, 0);
  const top10PctShare = sum !== 0 ? (topSum / sum) * 100 : 0;

  return {
    members,
    mean,
    median,
    max: incomes.length > 0 ? Math.max(...incomes) : 0,
    min: incomes.length > 0 ? Math.min(...incomes) : 0,
    top10PctShare,
    topCount,
  };
}

/**
 * อัตราคงอยู่ของสมาชิกจาก previousRange ไป currentRange
 * คืน { retainedCount, previousCount, retentionPct } หรือ null ถ้าไม่มีช่วงก่อนหน้าให้เทียบ
 */
export function buildMemberRetention(monthlyRecordsForCommunity, currentRange, previousRange) {
  if (!currentRange || !previousRange) return null;

  const previousMembers = new Set(
    monthlyRecordsForCommunity
      .filter((r) => r.month >= previousRange.start && r.month <= previousRange.end)
      .map((r) => r.full_name)
  );
  const currentMembers = new Set(
    monthlyRecordsForCommunity
      .filter((r) => r.month >= currentRange.start && r.month <= currentRange.end)
      .map((r) => r.full_name)
  );

  if (previousMembers.size === 0) return null;

  let retainedCount = 0;
  previousMembers.forEach((name) => {
    if (currentMembers.has(name)) retainedCount += 1;
  });

  return {
    retainedCount,
    previousCount: previousMembers.size,
    currentCount: currentMembers.size,
    retentionPct: (retainedCount / previousMembers.size) * 100,
  };
}

// --- แท็บ "เปรียบเทียบ" ---

/**
 * จัดอันดับชุมชนทั้งหมดในภาคเดียวกัน ตามรายได้สุทธิของช่วงเดือนที่ระบุ
 * communities: รายชื่อชุมชนทั้งหมด (มีฟิลด์ region)
 * allSummaryRows: monthly_summary ทุกชุมชน (ไม่กรอง)
 * คืน { rank, total, list: [{community_key, netIncome}] เรียงมาก->น้อย }
 */
export function buildRegionalIncomeRanking(communities, allSummaryRows, targetCommunityKey, range) {
  const target = communities.find((c) => c.community_key === targetCommunityKey);
  if (!target) return null;
  const regionCommunities = communities.filter((c) => c.region === target.region);

  const list = regionCommunities.map((c) => {
    const rows = allSummaryRows.filter((r) => r.community_key === c.community_key);
    const totals = sumRangeTotals(rows, range);
    return { communityKey: c.community_key, netIncome: totals ? totals.netIncome : 0 };
  });

  list.sort((a, b) => b.netIncome - a.netIncome);
  const rank = list.findIndex((entry) => entry.communityKey === targetCommunityKey) + 1;

  return { rank, total: list.length, list };
}

/**
 * จัดอันดับการเติบโตของรายได้สุทธิระหว่างช่วงปัจจุบันกับช่วงก่อนหน้า เทียบกับ
 * ชุมชนอื่นในภาคเดียวกัน — ชุมชนที่ไม่มีข้อมูลในช่วงฐาน (previous) หรือช่วงปัจจุบัน
 * จะไม่ถูกจัดอันดับ เพราะคำนวณ % เติบโตไม่ได้ ไม่ใช่ถือว่าเติบโต -100% (ป้องกันการ
 * ตีความผิดว่า "หยุดส่งข้อมูล" เท่ากับ "รายได้ลดลงจริง 100%")
 */
export function buildRegionalGrowthRanking(communities, allSummaryRows, targetCommunityKey, currentRange, previousRange) {
  const target = communities.find((c) => c.community_key === targetCommunityKey);
  if (!target || !previousRange) return null;
  const regionCommunities = communities.filter((c) => c.region === target.region);

  const list = [];
  regionCommunities.forEach((c) => {
    const rows = allSummaryRows.filter((r) => r.community_key === c.community_key);
    const currentTotals = sumRangeTotals(rows, currentRange);
    const previousTotals = sumRangeTotals(rows, previousRange);
    if (!previousTotals || previousTotals.monthsWithData === 0) return; // ไม่มีฐานเทียบ ข้าม
    if (!currentTotals || currentTotals.monthsWithData === 0) return; // ช่วงนี้ไม่มีข้อมูล ข้าม (ไม่ใช่ -100%)
    const growthPct = percentChange(currentTotals.netIncome, previousTotals.netIncome);
    if (growthPct === null) return;
    list.push({ communityKey: c.community_key, growthPct });
  });

  list.sort((a, b) => b.growthPct - a.growthPct);
  const rank = list.findIndex((entry) => entry.communityKey === targetCommunityKey) + 1;

  return { rank: rank > 0 ? rank : null, total: list.length, list };
}

/**
 * โปรไฟล์เศรษฐกิจของชุมชนนี้ เทียบกับค่าเฉลี่ยของทุกชุมชนในภาคเดียวกัน (ช่วงเดือนที่ระบุ)
 *
 * หมายเหตุ: ฟังก์ชันนี้ตอบคำถามคนละแบบกับ buildIncomeComposition() — ที่นี่เปรียบเทียบ
 * "สัดส่วนกิจกรรมทางเศรษฐกิจโดยรวม" (พึ่งพาการขาย / พึ่งพาตนเอง / แบ่งปัน) ของชุมชนนี้
 * เทียบกับภาค ไม่ได้พยายามแยกส่วนประกอบของ "รายได้สุทธิ" จึงรวมลดรายจ่ายครัวเรือนเข้า
 * ฐานคำนวณ % ด้วย (ต่างจาก buildIncomeComposition ที่ตัดออกเพราะไม่ใช่ส่วนของรายได้สุทธิ)
 * คำนวณ % ของทั้งชุมชนนี้และค่าเฉลี่ยภาคด้วยฐานเดียวกันเสมอ (ขาย+ซื้อ+แบ่งปัน+ลดรายจ่าย)
 * เพื่อให้เทียบกันได้ตรง ๆ ไม่ใช้ค่าจาก buildIncomeComposition ตรง ๆ เพราะฐานคนละแบบ
 */
export function buildRegionalEconomicProfile(communities, allSummaryRows, targetCommunityKey, range) {
  const target = communities.find((c) => c.community_key === targetCommunityKey);
  if (!target) return null;
  const regionCommunities = communities.filter((c) => c.region === target.region);

  const selfTotals = sumRangeTotals(
    allSummaryRows.filter((r) => r.community_key === targetCommunityKey),
    range
  );
  if (!selfTotals) return null;
  const selfBase = selfTotals.sale + selfTotals.purchase + selfTotals.sharing + selfTotals.householdReduction;
  const selfPct = (v) => (selfBase !== 0 ? (v / selfBase) * 100 : 0);

  // ค่าเฉลี่ยภาค: รวมยอดทุกชุมชนในภาคก่อน แล้วคำนวณสัดส่วนจากผลรวม (ไม่ใช่เฉลี่ยของ
  // เปอร์เซ็นต์รายชุมชน) เพื่อไม่ให้ชุมชนเล็กที่มีข้อมูลผิดเพี้ยนถ่วงค่าเฉลี่ยเกินจริง
  const regionTotals = regionCommunities.reduce(
    (acc, c) => {
      const rows = allSummaryRows.filter((r) => r.community_key === c.community_key);
      const t = sumRangeTotals(rows, range);
      if (t) {
        acc.sale += t.sale;
        acc.purchase += t.purchase;
        acc.sharing += t.sharing;
        acc.householdReduction += t.householdReduction;
      }
      return acc;
    },
    { sale: 0, purchase: 0, sharing: 0, householdReduction: 0 }
  );
  const regionBase =
    regionTotals.sale + regionTotals.purchase + regionTotals.sharing + regionTotals.householdReduction;
  const regionPct = (v) => (regionBase !== 0 ? (v / regionBase) * 100 : 0);

  return {
    self: {
      salePct: selfPct(selfTotals.sale),
      purchasePct: selfPct(selfTotals.purchase),
      sharingPct: selfPct(selfTotals.sharing),
      householdReductionPct: selfPct(selfTotals.householdReduction),
    },
    regional: {
      salePct: regionPct(regionTotals.sale),
      purchasePct: regionPct(regionTotals.purchase),
      sharingPct: regionPct(regionTotals.sharing),
      householdReductionPct: regionPct(regionTotals.householdReduction),
    },
    regionName: target.region,
    regionCommunityCount: regionCommunities.length,
  };
}

// --- แท็บ "รายสมาชิก" ---

/**
 * สร้างตารางสมาชิกของช่วงเดือน/เดือนเดียวที่ระบุ (month === 'all' หมายถึงทั้งช่วง)
 * คืน array เรียงตามรายได้สุทธิมาก->น้อย พร้อม rank
 */
export function buildMemberTable(monthlyRecordsForCommunity, range, month) {
  if (!range) return [];

  let rows = monthlyRecordsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );
  if (month !== 'all') {
    rows = rows.filter((r) => r.month.split('-')[1] === month);
  }

  const byMember = new Map();
  rows.forEach((r) => {
    const sale = Number(r['ขาย']) || 0;
    const purchase = Number(r['ซื้อ']) || 0;
    const sharing = Number(r['แบ่งปัน']) || 0;
    const existing = byMember.get(r.full_name) || {
      fullName: r.full_name,
      joinYear: r.join_year,
      sale: 0,
      purchase: 0,
      sharing: 0,
    };
    existing.sale += sale;
    existing.purchase += purchase;
    existing.sharing += sharing;
    byMember.set(r.full_name, existing);
  });

  const members = Array.from(byMember.values()).map((m) => ({
    ...m,
    netIncome: m.sale - m.purchase + m.sharing,
  }));
  members.sort((a, b) => b.netIncome - a.netIncome);
  return members;
}

/**
 * รายได้สุทธิรายเดือนของสมาชิกคนเดียว ตลอด "ช่วงที่เลือกอยู่" (selectedRange เต็ม ไม่ผูก
 * กับตัวกรอง "เดือนเดียว" ของตารางรายสมาชิก) ใช้กับกราฟรายเดือนที่กดดูรายคนได้ในแท็บ
 * "รายสมาชิก" — เดือนที่สมาชิกคนนี้ไม่มีแถวข้อมูลถือเป็น 0 แต่ทำเครื่องหมาย hasData ไว้
 * แยก เหมือนฟังก์ชันกราฟรายเดือนอื่น ๆ ในไฟล์นี้ (buildSeasonalBreakdown ฯลฯ)
 */
export function buildMemberMonthlySeries(monthlyRecordsForCommunity, range, fullName) {
  if (!range || !fullName) return null;
  const rows = monthlyRecordsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end && r.full_name === fullName
  );
  return enumerateMonths(range.start, range.end).map((m) => {
    const row = rows.find((r) => r.month === m);
    const netIncome = row
      ? (Number(row['ขาย']) || 0) - (Number(row['ซื้อ']) || 0) + (Number(row['แบ่งปัน']) || 0)
      : 0;
    return { label: formatMonthLabel(m), netIncome, hasData: Boolean(row) };
  });
}

// --- ส่วนขยายแท็บ "วิเคราะห์เชิงลึก" (ไอเดียข้อ 1-7) ---

/**
 * เทียบรายได้สุทธิรายเดือนของ "หลายปีย้อนหลัง" ซ้อนกันบนกราฟเดียว เดือนต่อเดือนแบบ
 * index ต่อ index (ใช้ได้เพราะทุกช่วง — ปีงบหรือปีปฏิทิน — ยาว 12 เดือนเท่ากันเสมอ ดู
 * fiscalYears.js) periods คือ chain จาก buildPeriodChain() (index 0 = ปีที่เลือกอยู่
 * ปัจจุบัน ไล่ย้อนไปเก่ากว่าเรื่อย ๆ) เดือนไหนไม่มีแถวข้อมูลจริง ใช้ 0 ในการคำนวณกราฟ/
 * ยอดรวม แต่ทำเครื่องหมาย hasData ไว้ให้ UI เลือกแสดงต่าง (เช่น จุดจาง ๆ) เพื่อไม่ให้
 * ตีความว่า "รายได้เป็น 0 จริง" ผิดจากที่ควรเป็น "ไม่มีข้อมูล"
 */
export function buildMultiYearComparison(summaryRowsForCommunity, periods) {
  if (!periods || periods.length === 0) return null;

  const monthsPerPeriod = periods.map((p) => enumerateMonths(p.range.start, p.range.end));
  const monthCount = monthsPerPeriod[0].length;
  if (monthsPerPeriod.some((m) => m.length !== monthCount)) return null; // กันไว้เผื่อกรณีผิดปกติ ปกติยาวเท่ากันเสมอทุกช่วง

  function findRow(monthStr) {
    return summaryRowsForCommunity.find((r) => r.month === monthStr) || null;
  }
  function netOf(row) {
    return row ? (Number(row.sale) || 0) - (Number(row.purchase) || 0) + (Number(row.sharing) || 0) : 0;
  }

  // label เดือนอ้างอิงจากช่วงแรก (ปีที่เลือกอยู่) ใช้เป็นแกน x ร่วมกันทุกเส้น เพราะเดือน
  // ที่ i ของทุกช่วงตรงกันเสมอ (ทุกช่วงเริ่มต้นเดือนเดียวกันของปีงบ/ปีปฏิทิน)
  const monthLabels = monthsPerPeriod[0].map((m) => formatMonthLabel(m));

  const series = periods.map((p, pIdx) => {
    const monthsList = monthsPerPeriod[pIdx];
    const points = monthsList.map((m) => {
      const row = findRow(m);
      return { value: netOf(row), hasData: Boolean(row) };
    });
    const total = points.reduce((a, pt) => a + pt.value, 0);
    // colorIndex = ตำแหน่งเดิมใน periods (0 = ปีปัจจุบันเสมอ) เก็บแยกจากตำแหน่งใน array
    // เพราะ UI จะให้ผู้ใช้เลือกซ่อน/แสดงบางปีได้ ถ้า UI กรอง series ออกแล้ว colorIndex
    // ยังต้องอ้างอิงตำแหน่งเดิมเพื่อให้สีของแต่ละปีไม่เปลี่ยนตามที่ซ่อน/แสดง
    return { key: p.value, label: p.label, points, total, colorIndex: pIdx, isCurrent: pIdx === 0 };
  });

  return { monthLabels, series };
}

/**
 * Lorenz curve เต็มรูปแบบ + ค่าสัมประสิทธิ์ Gini จากรายได้สุทธิรายบุคคล (ต่อยอดจาก
 * buildMemberIncomeStats ที่มีแค่ "ส่วนแบ่งของ 10% แรก" อย่างเดียว)
 *
 * หมายเหตุ: Lorenz curve/Gini นิยามไว้สำหรับค่าไม่ติดลบเท่านั้น รายได้สุทธิที่ติดลบ
 * (ซื้อมากกว่าขาย+แบ่งปันในเดือนนั้น) จะถูกปัดเป็น 0 เฉพาะในการคำนวณนี้จุดเดียว
 * ไม่กระทบตัวเลขรายได้จริงที่แสดงในการ์ดอื่น
 */
export function buildLorenzCurve(members) {
  if (!members || members.length === 0) return null;
  const incomes = members.map((m) => Math.max(0, m.netIncome)).sort((a, b) => a - b);
  const n = incomes.length;
  const total = incomes.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      gini: 0,
      n,
      total: 0,
    };
  }

  let cumIncome = 0;
  const points = [{ x: 0, y: 0 }];
  incomes.forEach((v, i) => {
    cumIncome += v;
    points.push({ x: ((i + 1) / n) * 100, y: (cumIncome / total) * 100 });
  });

  // สูตร Gini แบบไม่ต่อเนื่อง: G = (2·Σ(i·xᵢ))/(n·Σx) − (n+1)/n โดย xᵢ เรียงน้อย->มาก, i เริ่มที่ 1
  let weightedSum = 0;
  incomes.forEach((v, i) => {
    weightedSum += (i + 1) * v;
  });
  const gini = (2 * weightedSum) / (n * total) - (n + 1) / n;

  return { points, gini, n, total };
}

/**
 * ความผันผวนของรายได้ต่อสมาชิกแต่ละคนภายในช่วงที่เลือก วัดด้วย coefficient of variation
 * (CV = ส่วนเบี่ยงเบนมาตรฐาน / ค่าเฉลี่ย × 100) — ยิ่งสูงยิ่งแกว่งมาก เทียบกันได้ข้ามคน
 * แม้ฐานรายได้ต่างกัน (ต่างจาก SD เฉย ๆ ที่เทียบข้ามคนไม่ได้ตรง ๆ)
 * ต้องมีข้อมูลอย่างน้อย 2 เดือนและค่าเฉลี่ยเป็นบวกถึงจะวัดมีความหมาย (คนที่มีเดือนเดียว
 * หรือรายได้เฉลี่ย ≤ 0 จะไม่ถูกนำมาคำนวณ CV เพราะตีความไม่ได้/หารด้วยเลขไม่เป็นบวก)
 */
export function buildMemberVolatility(monthlyRecordsForCommunity, range) {
  if (!range) return null;
  const rows = monthlyRecordsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );

  const byMember = new Map(); // full_name -> netIncome[] รายเดือน
  rows.forEach((r) => {
    const net = (Number(r['ขาย']) || 0) - (Number(r['ซื้อ']) || 0) + (Number(r['แบ่งปัน']) || 0);
    if (!byMember.has(r.full_name)) byMember.set(r.full_name, []);
    byMember.get(r.full_name).push(net);
  });

  const members = [];
  byMember.forEach((values, fullName) => {
    if (values.length < 2) return;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    const cv = (sd / mean) * 100;
    members.push({ fullName, mean, sd, cv, monthsCounted: values.length });
  });

  members.sort((a, b) => b.cv - a.cv);
  const avgCv = members.length > 0 ? members.reduce((a, m) => a + m.cv, 0) / members.length : 0;

  return {
    members,
    avgCv,
    mostVolatile: members.slice(0, 5),
    mostStable: [...members].sort((a, b) => a.cv - b.cv).slice(0, 5),
  };
}

/**
 * แนวโน้มสัดส่วนแหล่งที่มาของรายได้ (ขาย / แบ่งปัน / ผลิตเอง / รับฟรี-อื่นๆ) รายเดือน
 * ตลอดช่วงที่เลือก — ใช้ดูว่าชุมชนพึ่งพาแหล่งไหนมากขึ้น/น้อยลงเมื่อเวลาผ่านไป ต่างจาก
 * buildIncomeComposition ที่สรุปเป็นก้อนเดียวของทั้งช่วง ที่นี่แยกเป็นรายเดือนเพื่อเห็น
 * แนวโน้ม ฐาน % คำนวณจาก (ขาย+แบ่งปัน+ผลิตเอง+รับฟรี) ของเดือนนั้น ๆ เอง (ไม่รวมซื้อ
 * เพราะเป็นรายจ่าย ไม่ใช่แหล่งที่มาของรายได้)
 */
export function buildDependencyTrend(summaryRowsForCommunity, range) {
  if (!range) return null;
  const months = enumerateMonths(range.start, range.end);

  const monthly = months.map((m) => {
    const row = summaryRowsForCommunity.find((r) => r.month === m);
    if (!row) {
      return {
        label: formatMonthLabel(m),
        hasData: false,
        salePct: 0,
        sharingPct: 0,
        selfProducedPct: 0,
        freeOtherPct: 0,
      };
    }
    const sale = Number(row.sale) || 0;
    const sharing = Number(row.sharing) || 0;
    const selfProduced = Number(row.self_produced) || 0;
    const freeOther = Number(row.free_other) || 0;
    const base = sale + sharing + selfProduced + freeOther;
    const pct = (v) => (base !== 0 ? (v / base) * 100 : 0);
    return {
      label: formatMonthLabel(m),
      hasData: true,
      salePct: pct(sale),
      sharingPct: pct(sharing),
      selfProducedPct: pct(selfProduced),
      freeOtherPct: pct(freeOther),
    };
  });

  const withData = monthly.filter((m) => m.hasData);
  const avg = (key) => (withData.length > 0 ? withData.reduce((a, m) => a + m[key], 0) / withData.length : 0);

  return {
    monthly,
    avgSalePct: avg('salePct'),
    avgSharingPct: avg('sharingPct'),
    avgSelfProducedPct: avg('selfProducedPct'),
    avgFreeOtherPct: avg('freeOtherPct'),
  };
}

/**
 * จัดอันดับรายได้สุทธิเทียบกับชุมชนอื่นใน "จังหวัดเดียวกัน" (แคบกว่าและเจาะจงกว่า
 * buildRegionalIncomeRanking ในแท็บเปรียบเทียบที่จัดอันดับระดับภาค) — คืน null ถ้าไม่มี
 * ข้อมูลจังหวัดของชุมชนนี้ หรือไม่มีชุมชนอื่นในจังหวัดเดียวกันให้เทียบ
 */
export function buildProvincePeerRanking(communities, allSummaryRows, targetCommunityKey, range) {
  const target = communities.find((c) => c.community_key === targetCommunityKey);
  if (!target || !target.province) return null;
  const provinceCommunities = communities.filter((c) => c.province === target.province);
  if (provinceCommunities.length <= 1) return null;

  const list = provinceCommunities.map((c) => {
    const rows = allSummaryRows.filter((r) => r.community_key === c.community_key);
    const totals = sumRangeTotals(rows, range);
    return { communityKey: c.community_key, netIncome: totals ? totals.netIncome : 0 };
  });

  list.sort((a, b) => b.netIncome - a.netIncome);
  const rank = list.findIndex((entry) => entry.communityKey === targetCommunityKey) + 1;

  return { rank, total: list.length, list, provinceName: target.province };
}

/**
 * พยากรณ์แนวโน้มรายได้สุทธิเดือนถัดไปแบบง่าย จากประวัติจริงทั้งหมดของชุมชนนี้ (ไม่ผูก
 * กับช่วงที่เลือกดูอยู่ด้านบน เพราะยิ่งมีประวัติยาวยิ่งพยากรณ์ได้แม่นกว่า) ใช้ข้อมูล
 * windowSize เดือนล่าสุดที่มีจริง คำนวณทั้งค่าเฉลี่ยเคลื่อนที่ (moving average) และเส้น
 * แนวโน้มเชิงเส้นอย่างง่าย (simple linear regression) — เป็นการประมาณคร่าว ๆ เพื่อดู
 * ทิศทาง ไม่ใช่โมเดลพยากรณ์ที่แม่นยำสูง จึงไม่ควรใช้ตัดสินใจเชิงนโยบายโดยลำพัง
 */
export function buildSimpleForecast(summaryRowsForCommunity, windowSize = 6) {
  const sorted = [...summaryRowsForCommunity].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length < 3) return null;

  const recent = sorted.slice(-windowSize);
  const netIncomes = recent.map(
    (r) => (Number(r.sale) || 0) - (Number(r.purchase) || 0) + (Number(r.sharing) || 0)
  );
  const n = netIncomes.length;

  const movingAverage = netIncomes.reduce((a, b) => a + b, 0) / n;

  const xs = netIncomes.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = movingAverage;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - meanX) * (netIncomes[i] - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  const linearForecast = intercept + slope * n;

  const lastMonth = recent[recent.length - 1].month;
  let [y, m] = lastMonth.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  const nextMonthLabel = formatMonthLabel(`${y}-${String(m).padStart(2, '0')}`);

  return {
    windowMonths: n,
    movingAverage,
    linearForecast,
    // slope วัดหน่วยบาท/เดือน — ใช้ threshold ±1 บาทกันตัวเลข noise เล็กน้อยไม่ให้ขึ้นว่า
    // "มีแนวโน้ม" ทั้งที่จริงแทบราบ
    trendDirection: slope > 1 ? 'up' : slope < -1 ? 'down' : 'flat',
    nextMonthLabel,
    recentMonthly: recent.map((r, i) => ({ label: formatMonthLabel(r.month), netIncome: netIncomes[i] })),
  };
}

/**
 * แยกสาเหตุการเติบโต (หรือหดตัว) ของรายได้สุทธิรวม ระหว่างช่วงปัจจุบันกับช่วงก่อนหน้า
 * ออกเป็น 2 ปัจจัย: (1) จำนวนสมาชิกเปลี่ยน (member count effect) และ (2) รายได้เฉลี่ย
 * ต่อคนเปลี่ยน (per-member income effect) — ผลรวม 2 ส่วนนี้เท่ากับผลต่างรายได้รวมพอดี
 * เสมอ (สูตรพีชคณิตตรง ไม่มีเศษเหลือ ไม่ใช่ค่าประมาณ):
 *   Δรวม = (สมาชิกปัจจุบัน − สมาชิกก่อนหน้า) × รายได้/คนปัจจุบัน   [ผลจากจำนวนคน]
 *        + สมาชิกก่อนหน้า × (รายได้/คนปัจจุบัน − รายได้/คนก่อนหน้า) [ผลจากรายได้ต่อคน]
 * คืน null ถ้าไม่มีช่วงก่อนหน้า หรือช่วงใดช่วงหนึ่งไม่มีข้อมูลเลย (คำนวณไม่ได้อย่างมี
 * ความหมาย เหตุผลเดียวกับ buildRegionalGrowthRanking)
 */
export function buildGrowthDrivers(summaryRowsForCommunity, monthlyRecordsForCommunity, currentRange, previousRange) {
  if (!currentRange || !previousRange) return null;

  const currentTotals = sumRangeTotals(summaryRowsForCommunity, currentRange);
  const previousTotals = sumRangeTotals(summaryRowsForCommunity, previousRange);
  if (!currentTotals || !previousTotals || previousTotals.monthsWithData === 0 || currentTotals.monthsWithData === 0) {
    return null;
  }

  const currentMembers = new Set(
    monthlyRecordsForCommunity
      .filter((r) => r.month >= currentRange.start && r.month <= currentRange.end)
      .map((r) => r.full_name)
  ).size;
  const previousMembers = new Set(
    monthlyRecordsForCommunity
      .filter((r) => r.month >= previousRange.start && r.month <= previousRange.end)
      .map((r) => r.full_name)
  ).size;

  if (previousMembers === 0) return null;

  const currentPerMember = currentMembers > 0 ? currentTotals.netIncome / currentMembers : 0;
  const previousPerMember = previousTotals.netIncome / previousMembers;

  const totalDelta = currentTotals.netIncome - previousTotals.netIncome;
  const memberCountEffect = (currentMembers - previousMembers) * currentPerMember;
  const perMemberIncomeEffect = previousMembers * (currentPerMember - previousPerMember);

  return {
    currentMembers,
    previousMembers,
    currentPerMember,
    previousPerMember,
    totalDelta,
    memberCountEffect,
    perMemberIncomeEffect,
  };
}
