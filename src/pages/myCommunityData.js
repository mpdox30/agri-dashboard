// src/pages/myCommunityData.js
//
// ฟังก์ชันคำนวณล้วนๆ สำหรับการ์ด "ชุมชนของฉัน" และข้อความ "ตั้งแต่ครั้งก่อนที่เข้ามา"
// ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของผู้ชมเอง (ไม่ส่งไปที่ไหน) จึงไม่มีประเด็นข้อมูลส่วนบุคคล

import { enumerateMonths, getPeriodRange, getPreviousPeriod } from './fiscalYears';
import { buildYearOverYearComparison } from './homepageAggregations';

function rowNet(r) {
  return (Number(r.sale) || 0) - (Number(r.purchase) || 0) + (Number(r.sharing) || 0);
}

/**
 * สรุปชุมชนเดียวในช่วงที่เลือก
 * rows: monthly_summary ที่ผ่าน cleanAllSummaryRows แล้ว (ทุกชุมชน ทุกปี)
 * คืน null ถ้าช่วงที่เลือกไม่มีนิยาม (เช่น เลือก "ทุกปี")
 *   { netIncome, monthsWithData, series (net รายเดือน, null = ไม่มีข้อมูล), deltaPct (เดือนเดียวกันปีก่อน) | null,
 *     pairedCount, provinceRank: { rank, total } | null }
 */
export function summarizeCommunity({ communityKey, rows, communities, yearType, year }) {
  if (year === 'all') return null;
  const range = getPeriodRange(yearType, year);
  if (!range) return null;

  const mine = rows.filter((r) => r.community_key === communityKey);
  const inRange = mine.filter((r) => r.month >= range.start && r.month <= range.end);
  const byMonth = new Map(inRange.map((r) => [r.month, rowNet(r)]));
  const series = enumerateMonths(range.start, range.end).map((m) => (byMonth.has(m) ? byMonth.get(m) : null));
  const netIncome = inRange.reduce((sum, r) => sum + rowNet(r), 0);

  let deltaPct = null;
  let pairedCount = 0;
  const previousYear = getPreviousPeriod(yearType, year);
  if (previousYear) {
    const previousRange = getPeriodRange(yearType, previousYear);
    const previousRows = mine.filter((r) => r.month >= previousRange.start && r.month <= previousRange.end);
    const cmp = buildYearOverYearComparison(inRange, previousRows);
    deltaPct = cmp.netIncomePct;
    pairedCount = cmp.pairedCount;
  }

  // อันดับในจังหวัดเดียวกัน (เฉพาะชุมชนที่มีข้อมูลในช่วงนี้)
  let provinceRank = null;
  const me = communities.find((c) => c.community_key === communityKey);
  if (me && inRange.length > 0) {
    const sameProvince = new Set(communities.filter((c) => c.province === me.province).map((c) => c.community_key));
    const totals = new Map();
    rows.forEach((r) => {
      if (!sameProvince.has(r.community_key)) return;
      if (r.month < range.start || r.month > range.end) return;
      totals.set(r.community_key, (totals.get(r.community_key) || 0) + rowNet(r));
    });
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([key]) => key === communityKey);
    if (idx >= 0) provinceRank = { rank: idx + 1, total: sorted.length };
  }

  return { netIncome, monthsWithData: inRange.length, series, deltaPct, pairedCount, provinceRank };
}

/** ภาพถ่ายสถานะข้อมูลตอนเข้ามาครั้งนี้ ไว้เทียบเมื่อกลับมาครั้งหน้า */
export function buildVisitSnapshot(rows, latestMonth, now = Date.now()) {
  const byCommunity = {};
  rows.forEach((r) => {
    byCommunity[r.community_key] = (byCommunity[r.community_key] || 0) + 1;
  });
  return { at: now, latestMonth: latestMonth || null, totalRows: rows.length, byCommunity };
}

/**
 * เทียบสถานะปัจจุบันกับครั้งก่อน
 * คืน null ถ้าไม่เคยเข้ามา, ไม่งั้น { daysAgo, newRowsTotal, newRowsMine, previousLatestMonth, latestMonthChanged }
 */
export function describeSinceLastVisit(previous, current, myCommunityKey, now = Date.now()) {
  if (!previous || !previous.at) return null;
  const daysAgo = Math.max(0, Math.floor((now - previous.at) / 86_400_000));
  const newRowsTotal = Math.max(0, current.totalRows - (previous.totalRows || 0));
  const prevMine = myCommunityKey && previous.byCommunity ? previous.byCommunity[myCommunityKey] || 0 : 0;
  const curMine = myCommunityKey ? current.byCommunity[myCommunityKey] || 0 : 0;
  return {
    daysAgo,
    newRowsTotal,
    newRowsMine: myCommunityKey ? Math.max(0, curMine - prevMine) : null,
    previousLatestMonth: previous.latestMonth || null,
    latestMonthChanged: Boolean(previous.latestMonth && current.latestMonth && previous.latestMonth !== current.latestMonth),
  };
}
