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
/**
 * สร้างตารางสมาชิกของช่วงที่ระบุ คืน array เรียงตามรายได้สุทธิมาก->น้อย
 * (เดิมรับ month แยกสำหรับกรองเฉพาะเดือนเดียวภายในปี — ตอนนี้ใช้ range ตรง ๆ แทน เพราะ
 * "ช่วงเดือนย่อยที่เลือก" ถูกคำนวณรวมไว้ใน range ให้แล้วที่ CommunityView ก่อนส่งเข้ามา)
 */
export function buildMemberTable(monthlyRecordsForCommunity, range) {
  if (!range) return [];

  const rows = monthlyRecordsForCommunity.filter(
    (r) => r.month >= range.start && r.month <= range.end
  );

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
