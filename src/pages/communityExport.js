// src/pages/communityExport.js
//
// ฟังก์ชันสร้างชุดข้อมูลสำหรับดาวน์โหลดจากหน้า "ข้อมูลเชิงวิเคราะห์" — แยกออกมาจาก
// communityAggregations.js เพราะเป็นเรื่องการ "ประกอบ" ข้อมูลที่คำนวณไว้แล้วให้เป็น
// ตารางส่งออก ไม่ใช่ตรรกะคำนวณหลักของหน้าเว็บ

import { FISCAL_YEAR_RANGES, FISCAL_YEAR_DISPLAY_LABEL, FISCAL_YEAR_ORDER, getPreviousFiscalYear } from './fiscalYears';
import {
  sumRangeTotals,
  buildSeasonalBreakdown,
  buildIncomeComposition,
  buildMemberIncomeStats,
  buildRegionalIncomeRanking,
  buildRegionalGrowthRanking,
  cleanAllSummaryRows,
} from './communityAggregations';

/**
 * สร้างชุดข้อมูล 3 ชีตสำหรับดาวน์โหลดของชุมชนเดียว ครอบคลุมหลายปีงบที่เลือกไว้
 * yearKeys: array ของ fiscal year key ที่เลือก (เช่น ['67-68', '68-69']) — มาจาก
 * กล่องเลือกแยกอิสระในหน้าเว็บ ไม่ใช่ปีที่กำลังดูอยู่บนหน้าจอหลัก
 */
export function buildCommunityExportSheets(communities, allSummaryRows, recordsForCommunity, communityKey, yearKeys) {
  const target = communities.find((c) => c.community_key === communityKey);
  const cleanedAllSummaryRows = cleanAllSummaryRows(allSummaryRows);
  const summaryRowsForCommunity = cleanedAllSummaryRows.filter((r) => r.community_key === communityKey);

  const sortedYearKeys = [...yearKeys].sort(
    (a, b) => FISCAL_YEAR_ORDER.indexOf(a) - FISCAL_YEAR_ORDER.indexOf(b)
  );

  // ชีต 1: สรุปรายเดือน (ทุกปีที่เลือก เรียงต่อกันตามลำดับเวลา)
  const monthlyRows = [];
  sortedYearKeys.forEach((yearKey) => {
    const range = FISCAL_YEAR_RANGES[yearKey];
    const rows = summaryRowsForCommunity.filter((r) => r.month >= range.start && r.month <= range.end);
    rows
      .sort((a, b) => a.month.localeCompare(b.month))
      .forEach((r) => {
        const sale = Number(r.sale) || 0;
        const purchase = Number(r.purchase) || 0;
        const sharing = Number(r.sharing) || 0;
        const household = Number(r.household_expense_reduction) || 0;
        monthlyRows.push([
          FISCAL_YEAR_DISPLAY_LABEL[yearKey],
          r.month,
          sale,
          purchase,
          sharing,
          household,
          sale - purchase + sharing,
        ]);
      });
  });
  const monthlySheet = {
    name: 'สรุปรายเดือน',
    headers: ['ปีงบ', 'เดือน', 'ขาย (บาท)', 'ซื้อ (บาท)', 'แบ่งปัน (บาท)', 'ลดรายจ่ายครัวเรือน (บาท)', 'รายได้สุทธิ (บาท)'],
    rows: monthlyRows,
  };

  // ชีต 2: รายสมาชิก (1 แถวต่อคนต่อปีที่เลือก — รวมทั้งปีในตารางเดียว เรียงตามปีงบ)
  const memberRows = [];
  sortedYearKeys.forEach((yearKey) => {
    const range = FISCAL_YEAR_RANGES[yearKey];
    const rowsInYear = recordsForCommunity.filter((r) => r.month >= range.start && r.month <= range.end);
    const byMember = new Map();
    rowsInYear.forEach((r) => {
      const sale = Number(r['ขาย']) || 0;
      const purchase = Number(r['ซื้อ']) || 0;
      const sharing = Number(r['แบ่งปัน']) || 0;
      const existing = byMember.get(r.full_name) || { fullName: r.full_name, joinYear: r.join_year, sale: 0, purchase: 0, sharing: 0 };
      existing.sale += sale;
      existing.purchase += purchase;
      existing.sharing += sharing;
      byMember.set(r.full_name, existing);
    });
    Array.from(byMember.values())
      .sort((a, b) => b.sale - a.sale)
      .forEach((m) => {
        memberRows.push([
          FISCAL_YEAR_DISPLAY_LABEL[yearKey],
          m.fullName,
          m.joinYear,
          m.sale,
          m.purchase,
          m.sharing,
          m.sale - m.purchase + m.sharing,
        ]);
      });
  });
  const memberSheet = {
    name: 'รายสมาชิก',
    headers: ['ปีงบ', 'สมาชิก', 'ปีที่เข้าร่วม', 'ขาย (บาท)', 'ซื้อ (บาท)', 'แบ่งปัน (บาท)', 'รายได้สุทธิ (บาท)'],
    rows: memberRows,
  };

  // ชีต 3: สรุปการวิเคราะห์ (1 แถวต่อปีที่เลือก)
  const analysisRows = sortedYearKeys.map((yearKey) => {
    const range = FISCAL_YEAR_RANGES[yearKey];
    const totals = sumRangeTotals(summaryRowsForCommunity, range);
    const seasonal = buildSeasonalBreakdown(summaryRowsForCommunity, range);
    const composition = buildIncomeComposition(summaryRowsForCommunity, range);
    const memberStats = buildMemberIncomeStats(recordsForCommunity, range);
    const incomeRanking = target
      ? buildRegionalIncomeRanking(communities, cleanedAllSummaryRows, communityKey, range)
      : null;
    const prevYearKey = getPreviousFiscalYear(yearKey);
    const prevRange = prevYearKey ? FISCAL_YEAR_RANGES[prevYearKey] : null;
    const growthRanking =
      target && prevRange
        ? buildRegionalGrowthRanking(communities, cleanedAllSummaryRows, communityKey, range, prevRange)
        : null;

    return [
      FISCAL_YEAR_DISPLAY_LABEL[yearKey],
      totals.monthsWithData,
      totals.netIncome,
      seasonal ? Math.round(seasonal.rainyPct * 10) / 10 : '',
      seasonal ? Math.round(seasonal.dryPct * 10) / 10 : '',
      composition ? Math.round(composition.purchasePctOfGross * 10) / 10 : '',
      memberStats ? Math.round(memberStats.mean) : '',
      memberStats ? Math.round(memberStats.median) : '',
      memberStats ? Math.round(memberStats.top10PctShare * 10) / 10 : '',
      incomeRanking ? `${incomeRanking.rank}/${incomeRanking.total}` : 'ไม่มีข้อมูลเพียงพอ',
      growthRanking && growthRanking.rank ? `${growthRanking.rank}/${growthRanking.total}` : 'ไม่มีข้อมูลเพียงพอ',
    ];
  });
  const analysisSheet = {
    name: 'สรุปการวิเคราะห์',
    headers: [
      'ปีงบ',
      'เดือนที่มีข้อมูล',
      'รายได้สุทธิ (บาท)',
      '% รายได้ฤดูฝน',
      '% รายได้ฤดูแล้ง',
      '% ซื้อเทียบรายได้ขาเข้า',
      'รายได้เฉลี่ยต่อคน (บาท)',
      'รายได้มัธยฐานต่อคน (บาท)',
      '% รายได้ของ 10% แรก',
      'อันดับรายได้ในภาค',
      'อันดับการเติบโตในภาค',
    ],
    rows: analysisRows,
  };

  const communityLabel = target ? `ชุมชน${target.community_key} (${target.province})` : communityKey;
  return { sheets: [monthlySheet, memberSheet, analysisSheet], communityLabel };
}
