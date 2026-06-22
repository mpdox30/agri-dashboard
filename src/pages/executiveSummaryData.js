// src/pages/executiveSummaryData.js
//
// ฟังก์ชันคำนวณข้อมูลสำหรับ "รายงานสรุปผู้บริหาร" (PDF) และ "เปรียบเทียบทั้งภาค/จังหวัด"
// (Excel) — ทั้งสองมองภาพรวมทั้ง 85 ชุมชนพร้อมกัน ไม่ใช่มุมมองชุมชนเดียวแบบหน้าวิเคราะห์

import { getPeriodRange, getPeriodDisplayLabel, getPreviousPeriod, enumerateMonths, formatMonthLabel } from './fiscalYears';
import { cleanAllSummaryRows, sumRangeTotals, percentChange } from './communityAggregations';

/**
 * คำนวณข้อมูลทั้งหมดที่ต้องใช้ในรายงานสรุปผู้บริหาร ของช่วงที่เลือก (ปีงบ/ปีปฏิทิน)
 */
export function buildExecutiveSummaryData(communities, allSummaryRows, yearType, year) {
  const cleanedRows = cleanAllSummaryRows(allSummaryRows);
  const range = getPeriodRange(yearType, year);
  const periodLabel = getPeriodDisplayLabel(yearType, year);
  const previousYearValue = getPreviousPeriod(yearType, year);
  const previousRange = previousYearValue ? getPeriodRange(yearType, previousYearValue) : null;

  // KPI รวมทั้งระบบ
  let totalSale = 0;
  let totalPurchase = 0;
  let totalSharing = 0;
  let totalHousehold = 0;
  const communitiesWithData = new Set();
  cleanedRows
    .filter((r) => r.month >= range.start && r.month <= range.end)
    .forEach((r) => {
      totalSale += Number(r.sale) || 0;
      totalPurchase += Number(r.purchase) || 0;
      totalSharing += Number(r.sharing) || 0;
      totalHousehold += Number(r.household_expense_reduction) || 0;
      communitiesWithData.add(r.community_key);
    });
  const totalNetIncome = totalSale - totalPurchase + totalSharing;

  // กราฟแนวโน้มรายเดือน
  const months = enumerateMonths(range.start, range.end);
  const monthlyTrend = months.map((m) => {
    const rows = cleanedRows.filter((r) => r.month === m);
    if (rows.length === 0) return { label: formatMonthLabel(m), netIncome: null };
    const sale = rows.reduce((s, r) => s + (Number(r.sale) || 0), 0);
    const purchase = rows.reduce((s, r) => s + (Number(r.purchase) || 0), 0);
    const sharing = rows.reduce((s, r) => s + (Number(r.sharing) || 0), 0);
    return { label: formatMonthLabel(m), netIncome: sale - purchase + sharing };
  });

  // จัดอันดับชุมชนทั้งหมด (สำหรับ Top 5 ในรายงาน PDF)
  const communityStats = communities.map((c) => {
    const rows = cleanedRows.filter((r) => r.community_key === c.community_key);
    const totals = sumRangeTotals(rows, range);
    const prevTotals = previousRange ? sumRangeTotals(rows, previousRange) : null;
    const growthPct =
      prevTotals && prevTotals.monthsWithData > 0 && totals.monthsWithData > 0
        ? percentChange(totals.netIncome, prevTotals.netIncome)
        : null;
    return {
      community_key: c.community_key,
      province: c.province,
      region: c.region,
      netIncome: totals.netIncome,
      monthsWithData: totals.monthsWithData,
      growthPct,
    };
  });

  const top5Income = [...communityStats]
    .filter((c) => c.monthsWithData > 0)
    .sort((a, b) => b.netIncome - a.netIncome)
    .slice(0, 5);

  const top5Growth = [...communityStats]
    .filter((c) => c.growthPct !== null)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 5);

  const completenessCount = months.length > 0
    ? communities.filter((c) => {
        const rows = cleanedRows.filter((r) => r.community_key === c.community_key);
        const presentMonths = new Set(rows.map((r) => r.month));
        return months.every((m) => presentMonths.has(m));
      }).length
    : 0;

  return {
    periodLabel,
    totalCommunities: communities.length,
    communitiesWithDataCount: communitiesWithData.size,
    completenessCount,
    totalSale,
    totalPurchase,
    totalSharing,
    totalHousehold,
    totalNetIncome,
    monthlyTrend,
    top5Income,
    top5Growth,
  };
}

/**
 * จัดอันดับชุมชนทั้งหมด 85 แห่งพร้อมกัน (ไม่ใช่เทียบกับชุมชนที่เลือกดูทีละแห่งแบบ
 * แท็บเปรียบเทียบของหน้าวิเคราะห์) — สำหรับดาวน์โหลดเป็น Excel
 */
export function buildRegionalComparisonRows(communities, allSummaryRows, yearType, year) {
  const cleanedRows = cleanAllSummaryRows(allSummaryRows);
  const range = getPeriodRange(yearType, year);
  const previousYearValue = getPreviousPeriod(yearType, year);
  const previousRange = previousYearValue ? getPeriodRange(yearType, previousYearValue) : null;

  const rows = communities.map((c) => {
    const communityRows = cleanedRows.filter((r) => r.community_key === c.community_key);
    const totals = sumRangeTotals(communityRows, range);
    const prevTotals = previousRange ? sumRangeTotals(communityRows, previousRange) : null;
    const growthPct =
      prevTotals && prevTotals.monthsWithData > 0 && totals.monthsWithData > 0
        ? percentChange(totals.netIncome, prevTotals.netIncome)
        : null;
    return {
      community_key: c.community_key,
      province: c.province,
      region: c.region,
      netIncome: totals.netIncome,
      monthsWithData: totals.monthsWithData,
      growthPct,
    };
  });

  // เรียงตามรายได้สุทธิมาก -> น้อย แล้วเติมอันดับ (เฉพาะที่มีข้อมูลในช่วงนี้)
  const withData = rows.filter((r) => r.monthsWithData > 0).sort((a, b) => b.netIncome - a.netIncome);
  const withoutData = rows.filter((r) => r.monthsWithData === 0);
  withData.forEach((r, i) => {
    r.incomeRank = i + 1;
  });

  const sheetRows = [...withData, ...withoutData].map((r) => [
    r.community_key,
    r.province,
    r.region,
    r.netIncome,
    r.incomeRank || '',
    r.growthPct !== null ? Math.round(r.growthPct * 10) / 10 : 'ไม่มีข้อมูลเพียงพอ',
    r.monthsWithData,
  ]);

  return {
    headers: ['ชุมชน', 'จังหวัด', 'ภาค', 'รายได้สุทธิ (บาท)', 'อันดับรายได้ (ทั้งระบบ)', '% การเติบโต', 'เดือนที่มีข้อมูล'],
    rows: sheetRows,
  };
}
