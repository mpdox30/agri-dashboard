// src/pages/homepageAggregations.js
//
// ฟังก์ชันคำนวณล้วน ๆ (pure function) แยกออกจาก Homepage.jsx เพื่อให้ทดสอบได้ง่าย
// และอ่านง่ายขึ้น ไม่ผูกกับ React

import { FISCAL_YEAR_RANGES, enumerateMonths, formatMonthLabel, getPeriodRange, getPeriodDisplayLabel } from './fiscalYears';
import { cleanAllSummaryRows, sumRangeTotals } from './communityAggregations';

/** คืน true ถ้า month (YYYY-MM) อยู่ในช่วงปีงบที่ระบุ */
function isInFiscalYear(month, fiscalYearKey) {
  if (fiscalYearKey === 'all') return true;
  const range = FISCAL_YEAR_RANGES[fiscalYearKey];
  if (!range) return false;
  return month >= range.start && month <= range.end;
}

/**
 * หาชุมชนที่ยังไม่มีข้อมูลของเดือนปัจจุบัน (currentMonth, "YYYY-MM") พร้อมคาดการณ์
 * รายได้ที่ "ควรจะมี" จากค่าเฉลี่ยของเดือนเดียวกันในปีก่อน ๆ (seasonal-naive forecast)
 *
 * ใช้ข้อมูลที่ผ่านการตัด "เดือนที่น่าจะไม่ได้กรอกข้อมูลจริง" ออกแล้ว (ดู
 * cleanAllSummaryRows ใน communityAggregations.js) ทั้งสำหรับตรวจว่าใครยังไม่ส่ง และ
 * สำหรับคำนวณค่าเฉลี่ยคาดการณ์ — ไม่งั้นเดือนที่เป็น 0 ปลอม ๆ จะดึงค่าเฉลี่ยให้ต่ำเกินจริง
 *
 * คืน array เรียงจาก "ขาดส่งนานที่สุด" -> "เพิ่งขาดส่ง":
 *   { community_key, province, lastReportedMonth, forecast: { average, sampleSize } | null }
 */
export function buildOverdueReport(communities, allSummaryRows, currentMonth) {
  const cleanedRows = cleanAllSummaryRows(allSummaryRows);
  const targetMonthNum = currentMonth.split('-')[1];

  const rowsByCommunity = new Map();
  cleanedRows.forEach((r) => {
    if (!rowsByCommunity.has(r.community_key)) rowsByCommunity.set(r.community_key, []);
    rowsByCommunity.get(r.community_key).push(r);
  });

  const overdue = [];
  communities.forEach((c) => {
    const rows = rowsByCommunity.get(c.community_key) || [];
    const hasCurrentMonth = rows.some((r) => r.month === currentMonth);
    if (hasCurrentMonth) return;

    const sortedMonths = rows.map((r) => r.month).sort();
    const lastReportedMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;

    // ค่าเฉลี่ยของเดือนเดียวกัน (เช่น "มิถุนายน") ในปีก่อน ๆ ทั้งหมดที่มีข้อมูลจริง
    const sameMonthValues = rows
      .filter((r) => r.month.split('-')[1] === targetMonthNum && r.month < currentMonth)
      .map((r) => (Number(r.sale) || 0) - (Number(r.purchase) || 0) + (Number(r.sharing) || 0));

    const forecast =
      sameMonthValues.length > 0
        ? {
            average: sameMonthValues.reduce((a, b) => a + b, 0) / sameMonthValues.length,
            sampleSize: sameMonthValues.length,
          }
        : null;

    overdue.push({
      community_key: c.community_key,
      province: c.province,
      lastReportedMonth,
      forecast,
    });
  });

  overdue.sort((a, b) => {
    if (!a.lastReportedMonth) return -1;
    if (!b.lastReportedMonth) return 1;
    return a.lastReportedMonth.localeCompare(b.lastReportedMonth);
  });

  return overdue;
}

/** คืน true ถ้า month (YYYY-MM) อยู่ในปีปฏิทินที่ระบุ (ค.ศ.) */
function isInCalendarYear(month, calendarYear) {
  if (calendarYear === 'all') return true;
  return month.startsWith(String(calendarYear));
}

/** กรอง monthly_summary rows ตาม filter state จาก FilterBar */
export function filterSummaryRows(summaryRows, filters) {
  const { yearType, year, month, region, province, community, communityToRegion, communityToProvince } = filters;

  return summaryRows.filter((row) => {
    const inYear =
      yearType === 'fiscal' ? isInFiscalYear(row.month, year) : isInCalendarYear(row.month, year);
    if (!inYear) return false;

    if (month !== 'all') {
      const rowMonth = row.month.split('-')[1];
      if (rowMonth !== month) return false;
    }

    if (community !== 'all' && row.community_key !== community) return false;

    if (region !== 'all' && region !== undefined) {
      const rowRegion = communityToRegion.get(row.community_key);
      if (rowRegion !== region) return false;
    }

    if (province !== 'all') {
      const rowProvince = communityToProvince.get(row.community_key);
      if (rowProvince !== province) return false;
    }

    return true;
  });
}

/** รวมยอดจาก summary rows ที่กรองแล้ว คืนค่ารวมตามชนิด */
export function aggregateTotals(filteredRows, totalCommunityCount) {
  let sale = 0;
  let purchase = 0;
  let sharing = 0;
  let householdReduction = 0;
  const communitiesSeen = new Set();

  filteredRows.forEach((row) => {
    sale += Number(row.sale) || 0;
    purchase += Number(row.purchase) || 0;
    sharing += Number(row.sharing) || 0;
    householdReduction += Number(row.household_expense_reduction) || 0;
    communitiesSeen.add(row.community_key);
  });

  return {
    netIncome: sale - purchase + sharing,
    householdReduction,
    communitiesWithData: communitiesSeen.size,
    totalCommunities: totalCommunityCount,
  };
}

/** สร้างข้อมูลกราฟรายเดือนสำหรับปีงบ/ปีปฏิทินที่เลือก รวมเดือนที่ยังไม่มีข้อมูล (null) */
export function buildMonthlySeries(summaryRows, filters) {
  const { yearType, year, region, province, community, communityToRegion, communityToProvince } = filters;

  // สร้างลิสต์เดือนทั้งหมดของช่วงที่เลือก (12 เดือนเสมอ ไม่ว่าจะมีข้อมูลจริงหรือไม่)
  let months;
  if (yearType === 'fiscal') {
    const range = FISCAL_YEAR_RANGES[year];
    if (!range) return [];
    months = enumerateMonths(range.start, range.end);
  } else {
    months = enumerateMonths(`${year}-01`, `${year}-12`);
  }

  const relevantRows = summaryRows.filter((row) => {
    if (community !== 'all' && row.community_key !== community) return false;
    if (region !== 'all' && region !== undefined && communityToRegion.get(row.community_key) !== region) return false;
    if (province !== 'all' && communityToProvince.get(row.community_key) !== province) return false;
    return true;
  });

  const totalsByMonth = new Map();
  relevantRows.forEach((row) => {
    const existing = totalsByMonth.get(row.month) || { sale: 0, purchase: 0, sharing: 0, hasAnyRow: false };
    existing.sale += Number(row.sale) || 0;
    existing.purchase += Number(row.purchase) || 0;
    existing.sharing += Number(row.sharing) || 0;
    existing.hasAnyRow = true;
    totalsByMonth.set(row.month, existing);
  });

  return months.map((m) => {
    const data = totalsByMonth.get(m);
    return {
      label: formatMonthLabel(m),
      // ไม่มีแถวเลยสำหรับเดือนนี้ = ยังไม่มีข้อมูลกรอกเข้ามา (ไม่ใช่ 0 จริง) -> null
      netIncome: data ? data.sale - data.purchase + data.sharing : null,
    };
  });
}

/**
 * รวมยอดตามจังหวัด เรียงจากมากไปน้อย
 * แต่ละจังหวัดมี series = รายได้สุทธิรายเดือน เรียงตามเดือนที่พบในข้อมูลที่กรองแล้ว (null = เดือนนั้นไม่มีแถวของจังหวัดนี้)
 * ไว้วาดเส้นแนวโน้มเล็กในการ์ดจังหวัด
 */
export function aggregateByProvince(filteredRows, communities) {
  const communityToProvince = new Map(communities.map((c) => [c.community_key, c.province]));

  const totals = new Map(); // province -> { netIncome, communitySet, byMonth }
  const monthSet = new Set();
  filteredRows.forEach((row) => {
    const province = communityToProvince.get(row.community_key);
    if (!province) return;
    const net = (Number(row.sale) || 0) - (Number(row.purchase) || 0) + (Number(row.sharing) || 0);
    const entry = totals.get(province) || { netIncome: 0, communitySet: new Set(), byMonth: new Map() };
    entry.netIncome += net;
    entry.communitySet.add(row.community_key);
    entry.byMonth.set(row.month, (entry.byMonth.get(row.month) || 0) + net);
    monthSet.add(row.month);
    totals.set(province, entry);
  });

  const months = Array.from(monthSet).sort();

  return Array.from(totals.entries())
    .map(([province, entry]) => ({
      province,
      netIncome: entry.netIncome,
      communityCount: entry.communitySet.size,
      series: months.map((m) => (entry.byMonth.has(m) ? entry.byMonth.get(m) : null)),
    }))
    .sort((a, b) => b.netIncome - a.netIncome);
}

/**
 * สร้างชุดข้อมูล 3 ชีตสำหรับดาวน์โหลดจากหน้าแรก — ดึงข้อมูล "ทั้งระบบ" เสมอ ไม่ว่าจะ
 * กรองจังหวัด/ชุมชนอะไรอยู่บนหน้าจอ (ตามที่ตกลงกันไว้) เฉพาะปี/ประเภทปีที่เลือกไว้
 * ใช้ข้อมูลที่ทำความสะอาดแล้ว (ตัดเดือนที่น่าจะไม่ได้กรอกข้อมูลจริงออก) เพื่อให้ตรงกับ
 * ตัวเลขที่หน้าจอแสดงอยู่จริง ไม่ใช่ข้อมูลดิบที่ยังมีเดือน 0 ปลอม ๆ ปนอยู่
 */
export function buildHomepageExportSheets(communities, allSummaryRows, yearType, year) {
  const cleanedRows = cleanAllSummaryRows(allSummaryRows);
  const range = getPeriodRange(yearType, year);
  const periodLabel = getPeriodDisplayLabel(yearType, year);

  const rowsInRange = cleanedRows.filter((r) => r.month >= range.start && r.month <= range.end);
  const communityToProvinceMap = new Map(communities.map((c) => [c.community_key, c.province]));

  // ชีต 1: สรุปรายเดือน
  const months = enumerateMonths(range.start, range.end);
  const monthlySheet = {
    name: 'สรุปรายเดือน',
    headers: ['เดือน', 'ขาย (บาท)', 'ซื้อ (บาท)', 'แบ่งปัน (บาท)', 'ลดรายจ่ายครัวเรือน (บาท)', 'รายได้สุทธิ (บาท)'],
    rows: months.map((m) => {
      const rows = rowsInRange.filter((r) => r.month === m);
      const sale = rows.reduce((sum, r) => sum + (Number(r.sale) || 0), 0);
      const purchase = rows.reduce((sum, r) => sum + (Number(r.purchase) || 0), 0);
      const sharing = rows.reduce((sum, r) => sum + (Number(r.sharing) || 0), 0);
      const household = rows.reduce((sum, r) => sum + (Number(r.household_expense_reduction) || 0), 0);
      return [formatMonthLabel(m) + ' ' + m.split('-')[0], sale, purchase, sharing, household, sale - purchase + sharing];
    }),
  };

  // ชีต 2: สรุปรายจังหวัด
  const provinceTotals = new Map(); // province -> { sale, purchase, sharing, household, communitySet }
  rowsInRange.forEach((r) => {
    const province = communityToProvinceMap.get(r.community_key);
    if (!province) return;
    const entry = provinceTotals.get(province) || { sale: 0, purchase: 0, sharing: 0, household: 0, communitySet: new Set() };
    entry.sale += Number(r.sale) || 0;
    entry.purchase += Number(r.purchase) || 0;
    entry.sharing += Number(r.sharing) || 0;
    entry.household += Number(r.household_expense_reduction) || 0;
    entry.communitySet.add(r.community_key);
    provinceTotals.set(province, entry);
  });
  const provinceRows = Array.from(provinceTotals.entries())
    .map(([province, e]) => [province, e.communitySet.size, e.sale, e.purchase, e.sharing, e.household, e.sale - e.purchase + e.sharing])
    .sort((a, b) => b[6] - a[6]);
  const provinceSheet = {
    name: 'สรุปรายจังหวัด',
    headers: ['จังหวัด', 'จำนวนชุมชน', 'ขาย (บาท)', 'ซื้อ (บาท)', 'แบ่งปัน (บาท)', 'ลดรายจ่ายครัวเรือน (บาท)', 'รายได้สุทธิ (บาท)'],
    rows: provinceRows,
  };

  // ชีต 3: สรุปรายชุมชน (ทุกชุมชนในระบบ ไม่กรองอะไรเลย)
  const communitySheet = {
    name: 'สรุปรายชุมชน',
    headers: ['ชุมชน', 'จังหวัด', 'ภาค', 'ขาย (บาท)', 'ซื้อ (บาท)', 'แบ่งปัน (บาท)', 'ลดรายจ่ายครัวเรือน (บาท)', 'รายได้สุทธิ (บาท)', 'เดือนที่มีข้อมูล'],
    rows: communities.map((c) => {
      const rows = rowsInRange.filter((r) => r.community_key === c.community_key);
      const totals = sumRangeTotals(rows, range);
      return [
        c.community_key,
        c.province,
        c.region,
        totals.sale,
        totals.purchase,
        totals.sharing,
        totals.householdReduction,
        totals.netIncome,
        totals.monthsWithData,
      ];
    }),
  };

  return { sheets: [monthlySheet, provinceSheet, communitySheet], periodLabel };
}

/**
 * เดือนล่าสุด (YYYY-MM) ที่มีข้อมูลจริงในระบบ: ตัดเดือนที่น่าจะไม่ได้กรอกออกก่อน (cleanAllSummaryRows)
 * แล้วข้ามเดือนที่ทุกยอดเป็น 0 ทั้งหมด เพื่อไม่ให้ป้าย "ข้อมูลล่าสุด" ชี้ไปที่เดือนที่ยังเป็นค่าว่างปลอม
 * คืน null ถ้าไม่มีข้อมูลเลย
 */
export function findLatestDataMonth(allSummaryRows) {
  const cleaned = cleanAllSummaryRows(allSummaryRows);
  let latest = null;
  cleaned.forEach((r) => {
    const hasValue =
      (Number(r.sale) || 0) !== 0 ||
      (Number(r.purchase) || 0) !== 0 ||
      (Number(r.sharing) || 0) !== 0 ||
      (Number(r.household_expense_reduction) || 0) !== 0;
    if (hasValue && (latest === null || r.month > latest)) latest = r.month;
  });
  return latest;
}

// ---------------------------------------------------------------------------
// เทียบกับปีก่อน "เดือนเดียวกัน": จับคู่เฉพาะ (ชุมชน, เดือน) ที่มีข้อมูลทั้งสองปี
// เพื่อไม่ให้ปีที่ยังไม่ครบ (เช่นปีงบปัจจุบัน) ถูกเทียบกับปีก่อนทั้งปีแล้วดูเหมือนรายได้ตก
// ---------------------------------------------------------------------------

/** ความเปลี่ยนแปลงไม่เกินค่านี้ (เป็น %) ถือว่า "ทรงตัว" ในการแบ่งกลุ่มชุมชน */
export const COMMUNITY_FLAT_THRESHOLD_PCT = 2;

/** "2026-03" + (-1 ปี) -> "2025-03" */
function shiftYear(month, deltaYears) {
  const [y, m] = month.split('-');
  return `${Number(y) + deltaYears}-${m}`;
}

function rowNet(r) {
  return (Number(r.sale) || 0) - (Number(r.purchase) || 0) + (Number(r.sharing) || 0);
}

/**
 * currentRows / previousRows: monthly_summary rows ที่ผ่านตัวกรองแล้วของปีปัจจุบัน / ปีก่อน
 * (ควรเป็นข้อมูลที่ผ่าน cleanAllSummaryRows แล้ว เพื่อไม่จับคู่กับเดือนที่ยังไม่ได้กรอกจริง)
 *
 * คืน { pairedCount, netIncomePct, householdPct, communities: { key, currentNet, previousNet, pct }[] }
 *   pairedCount = จำนวนคู่ (ชุมชน, เดือน) ที่ใช้เทียบ  ถ้า 0 ถือว่าเทียบไม่ได้ (pct เป็น null)
 */
export function buildYearOverYearComparison(currentRows, previousRows) {
  const previousByKey = new Map(previousRows.map((r) => [`${r.community_key}|${r.month}`, r]));
  const perCommunity = new Map();
  let pairedCount = 0;
  let curNet = 0;
  let prevNet = 0;
  let curHousehold = 0;
  let prevHousehold = 0;

  currentRows.forEach((r) => {
    const prev = previousByKey.get(`${r.community_key}|${shiftYear(r.month, -1)}`);
    if (!prev) return;
    pairedCount += 1;
    const cNet = rowNet(r);
    const pNet = rowNet(prev);
    curNet += cNet;
    prevNet += pNet;
    curHousehold += Number(r.household_expense_reduction) || 0;
    prevHousehold += Number(prev.household_expense_reduction) || 0;
    const entry = perCommunity.get(r.community_key) || { key: r.community_key, currentNet: 0, previousNet: 0 };
    entry.currentNet += cNet;
    entry.previousNet += pNet;
    perCommunity.set(r.community_key, entry);
  });

  const pct = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);
  return {
    pairedCount,
    netIncomePct: pairedCount ? pct(curNet, prevNet) : null,
    householdPct: pairedCount ? pct(curHousehold, prevHousehold) : null,
    communities: Array.from(perCommunity.values()).map((e) => ({ ...e, pct: pct(e.currentNet, e.previousNet) })),
  };
}

/** แบ่งชุมชนเป็น เพิ่มขึ้น / ทรงตัว / ลดลง จากผลของ buildYearOverYearComparison (ข้ามชุมชนที่ไม่มีฐานเทียบ) */
export function splitCommunitiesByChange(comparisonCommunities) {
  const result = { up: 0, flat: 0, down: 0, total: 0 };
  comparisonCommunities.forEach((c) => {
    if (c.pct === null) return;
    result.total += 1;
    if (Math.abs(c.pct) < COMMUNITY_FLAT_THRESHOLD_PCT) result.flat += 1;
    else if (c.pct > 0) result.up += 1;
    else result.down += 1;
  });
  return result;
}
