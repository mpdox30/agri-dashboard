// src/pages/CommunityView.jsx
import { useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlySummary, getMonthlyRecords } from '../api/appsScript';
import CommunityHeader from '../components/CommunityHeader';
import SubTabs from '../components/SubTabs';
import CommunityExportPanel from '../components/CommunityExportPanel';
import OverviewTab from './communityTabs/OverviewTab';
import AnalyticsTab from './communityTabs/AnalyticsTab';
import BenchmarkTab from './communityTabs/BenchmarkTab';
import MembersTab from './communityTabs/MembersTab';
import {
  getPeriodRange,
  getPeriodDisplayLabel,
  getPreviousPeriod,
  countMonthsWithData,
} from './fiscalYears';
import {
  sumRangeTotals,
  percentChange,
  buildFourYearTrend,
  buildSeasonalBreakdown,
  buildIncomeComposition,
  buildMemberIncomeStats,
  buildMemberRetention,
  buildRegionalIncomeRanking,
  buildRegionalGrowthRanking,
  buildRegionalEconomicProfile,
  buildMemberTable,
  cleanAllSummaryRows,
  findLikelyUnenteredMonths,
} from './communityAggregations';
import { buildCommunityExportSheets } from './communityExport';
import { downloadWorkbook } from '../utils/excelExport';
import './CommunityView.css';

const TABS = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'analytics', label: 'วิเคราะห์เชิงลึก' },
  { key: 'benchmark', label: 'เปรียบเทียบ' },
  { key: 'members', label: 'รายสมาชิก' },
];

export default function CommunityView() {
  const [communities, setCommunities] = useState([]);
  const [allSummaryRows, setAllSummaryRows] = useState([]);
  const [baseLoadState, setBaseLoadState] = useState('loading'); // loading | ready | error
  const [baseLoadError, setBaseLoadError] = useState(null);

  const [communityKey, setCommunityKey] = useState(null);
  const [yearType, setYearType] = useState('fiscal'); // 'fiscal' | 'calendar'
  const [year, setYear] = useState('68-69'); // fiscal year key หรือ calendar year string ตาม yearType
  const [month, setMonth] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  const [recordsForCommunity, setRecordsForCommunity] = useState([]);
  const [recordsLoadState, setRecordsLoadState] = useState('loading');
  const [isExporting, setIsExporting] = useState(false);

  // โหลด communities + monthly_summary (ทุกชุมชน) ครั้งเดียวตอน mount
  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      setBaseLoadState('loading');
      try {
        const [communitiesData, summaryData] = await Promise.all([
          getCommunities(),
          getMonthlySummary(),
        ]);
        if (cancelled) return;
        setCommunities(communitiesData);
        setAllSummaryRows(summaryData);
        setBaseLoadState('ready');
        // เลือกชุมชนแรกตามลำดับ community_key เป็นค่าเริ่มต้น (ถ้ายังไม่เคยเลือก)
        if (communitiesData.length > 0) {
          setCommunityKey((prev) => prev || [...communitiesData].sort((a, b) => a.community_key.localeCompare(b.community_key, 'th'))[0].community_key);
        }
      } catch (err) {
        if (cancelled) return;
        setBaseLoadError(err.message || String(err));
        setBaseLoadState('error');
      }
    }
    loadBase();
    return () => {
      cancelled = true;
    };
  }, []);

  // โหลด monthly_records เฉพาะชุมชนที่เลือก ทุกครั้งที่ communityKey เปลี่ยน
  useEffect(() => {
    if (!communityKey) return;
    let cancelled = false;
    async function loadRecords() {
      setRecordsLoadState('loading');
      try {
        const data = await getMonthlyRecords(communityKey);
        if (cancelled) return;
        setRecordsForCommunity(data);
        setRecordsLoadState('ready');
      } catch {
        if (cancelled) return;
        setRecordsLoadState('error');
      }
    }
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [communityKey]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.community_key === communityKey) || null,
    [communities, communityKey]
  );

  // เดือนที่ดูเหมือนกรอกครบ (มีแถว) แต่ค่าทุกอย่างเป็น 0 ต่อเนื่องยาว 4 เดือนขึ้นไป —
  // ถือว่าเทียบเท่าไม่ได้กรอกข้อมูลจริง (ตามที่ตกลงกัน) คำนวณจากข้อมูลดิบของชุมชนที่
  // เลือกอยู่ก่อนทำความสะอาด เพื่อรู้ว่า "ตัดเดือนไหนออกไปบ้าง" สำหรับโชว์คำอธิบาย
  const excludedMonthsForCommunity = useMemo(() => {
    const rawRowsForCommunity = allSummaryRows.filter((r) => r.community_key === communityKey);
    return findLikelyUnenteredMonths(rawRowsForCommunity);
  }, [allSummaryRows, communityKey]);

  // ข้อมูล summary "สะอาด" ของทุกชุมชน (ตัดเดือนที่น่าจะไม่ได้กรอกข้อมูลจริงออกแล้ว ของ
  // แต่ละชุมชนแยกกัน) ใช้แทนข้อมูลดิบทุกจุดด้านล่าง ทั้งของชุมชนที่เลือกดูอยู่และชุมชน
  // อื่นที่ใช้เทียบในแท็บเปรียบเทียบ เพื่อให้ทุกชุมชนถูกประเมินด้วยมาตรฐานเดียวกัน
  const cleanedAllSummaryRows = useMemo(() => cleanAllSummaryRows(allSummaryRows), [allSummaryRows]);

  const summaryRowsForCommunity = useMemo(
    () => cleanedAllSummaryRows.filter((r) => r.community_key === communityKey),
    [cleanedAllSummaryRows, communityKey]
  );

  // ตัดเดือนเดียวกัน (ที่ตัดจาก monthly_summary) ออกจาก monthly_records รายสมาชิกด้วย
  // เพื่อให้ภาพรวมกับรายสมาชิกสอดคล้องกัน ไม่ใช่จุดหนึ่งตัดออกอีกจุดยังเห็นอยู่
  const cleanedRecordsForCommunity = useMemo(
    () => recordsForCommunity.filter((r) => !excludedMonthsForCommunity.has(r.month)),
    [recordsForCommunity, excludedMonthsForCommunity]
  );

  const memberCount = useMemo(() => {
    const names = new Set(cleanedRecordsForCommunity.map((r) => r.full_name));
    return names.size;
  }, [cleanedRecordsForCommunity]);

  // ช่วงเดือนจริงของตัวเลือกปัจจุบัน (ไม่ว่าจะเป็นปีงบหรือปีปฏิทิน) — ทุกอย่างด้านล่าง
  // คำนวณจาก range นี้ตรง ๆ จึงเปลี่ยนตามตัวกรองที่เลือกไว้เสมอ
  const selectedRange = useMemo(() => getPeriodRange(yearType, year), [yearType, year]);
  const previousYearValue = useMemo(() => getPreviousPeriod(yearType, year), [yearType, year]);
  const previousRange = useMemo(
    () => (previousYearValue ? getPeriodRange(yearType, previousYearValue) : null),
    [yearType, previousYearValue]
  );
  const periodLabel = getPeriodDisplayLabel(yearType, year);
  const previousPeriodLabel = previousYearValue ? getPeriodDisplayLabel(yearType, previousYearValue) : null;

  const completeness = useMemo(
    () => countMonthsWithData(summaryRowsForCommunity, selectedRange),
    [summaryRowsForCommunity, selectedRange]
  );

  // KPI ของ header — ตามช่วงที่เลือกในตัวกรองหลักเสมอ
  const kpis = useMemo(() => {
    const totals = sumRangeTotals(summaryRowsForCommunity, selectedRange);
    if (!totals) return null;
    const prevTotals = previousRange ? sumRangeTotals(summaryRowsForCommunity, previousRange) : null;
    return {
      netIncome: totals.netIncome,
      householdReduction: totals.householdReduction,
      sharing: totals.sharing,
      perMember: memberCount > 0 ? totals.netIncome / memberCount : 0,
      deltas: {
        netIncome: prevTotals ? percentChange(totals.netIncome, prevTotals.netIncome) : null,
        householdReduction: prevTotals
          ? percentChange(totals.householdReduction, prevTotals.householdReduction)
          : null,
        sharing: prevTotals ? percentChange(totals.sharing, prevTotals.sharing) : null,
      },
    };
  }, [summaryRowsForCommunity, selectedRange, previousRange, memberCount]);

  const trend = useMemo(
    () => buildFourYearTrend(summaryRowsForCommunity),
    [summaryRowsForCommunity]
  );

  // แท็บวิเคราะห์เชิงลึก/เปรียบเทียบ — คำนวณจาก selectedRange ตรง ๆ เสมอ ไม่ว่าจะครบ
  // หรือไม่ครบก็ตาม (ต่างจากเดิมที่ใช้ "ปีล่าสุดที่ครบ" แทนปีที่เลือกไว้ — สร้างความสับสน)
  const seasonal = useMemo(
    () => buildSeasonalBreakdown(summaryRowsForCommunity, selectedRange),
    [summaryRowsForCommunity, selectedRange]
  );
  const composition = useMemo(
    () => buildIncomeComposition(summaryRowsForCommunity, selectedRange),
    [summaryRowsForCommunity, selectedRange]
  );
  const memberStats = useMemo(
    () => buildMemberIncomeStats(cleanedRecordsForCommunity, selectedRange),
    [cleanedRecordsForCommunity, selectedRange]
  );
  const retention = useMemo(
    () => buildMemberRetention(cleanedRecordsForCommunity, selectedRange, previousRange),
    [cleanedRecordsForCommunity, selectedRange, previousRange]
  );

  const incomeRanking = useMemo(
    () =>
      communityKey
        ? buildRegionalIncomeRanking(communities, cleanedAllSummaryRows, communityKey, selectedRange)
        : null,
    [communities, cleanedAllSummaryRows, communityKey, selectedRange]
  );
  const growthRanking = useMemo(
    () =>
      communityKey
        ? buildRegionalGrowthRanking(communities, cleanedAllSummaryRows, communityKey, selectedRange, previousRange)
        : null,
    [communities, cleanedAllSummaryRows, communityKey, selectedRange, previousRange]
  );
  const economicProfile = useMemo(
    () =>
      communityKey
        ? buildRegionalEconomicProfile(communities, cleanedAllSummaryRows, communityKey, selectedRange)
        : null,
    [communities, cleanedAllSummaryRows, communityKey, selectedRange]
  );

  const memberTable = useMemo(
    () => buildMemberTable(cleanedRecordsForCommunity, selectedRange, month),
    [cleanedRecordsForCommunity, selectedRange, month]
  );

  function handlePickerChange({ communityKey: nextKey, yearType: nextYearType, year: nextYear, month: nextMonth }) {
    setCommunityKey(nextKey);
    setYearType(nextYearType);
    setYear(nextYear);
    setMonth(nextMonth);
  }

  async function handleCommunityExport(exportCommunityKey, yearKeys) {
    setIsExporting(true);
    try {
      // ถ้าชุมชนที่เลือกดาวน์โหลดเป็นชุมชนเดียวกับที่กำลังดูอยู่ ใช้ข้อมูลที่โหลดไว้แล้ว
      // ได้เลย ไม่ต้องดึงซ้ำ — แต่ถ้าเลือกชุมชนอื่น ต้องดึง monthly_records ของชุมชนนั้น
      // ใหม่ เพราะหน้านี้โหลดแค่ข้อมูลของชุมชนที่กำลังดูอยู่บนหน้าจอเท่านั้น
      const recordsForExport =
        exportCommunityKey === communityKey ? recordsForCommunity : await getMonthlyRecords(exportCommunityKey);
      const { sheets, communityLabel } = buildCommunityExportSheets(
        communities,
        allSummaryRows,
        recordsForExport,
        exportCommunityKey,
        yearKeys
      );
      downloadWorkbook(sheets, `${communityLabel}_รายชุมชน`);
    } catch (err) {
      alert('สร้างไฟล์ดาวน์โหลดไม่สำเร็จ: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  }

  if (baseLoadState === 'loading') {
    return (
      <div className="community-status">
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (baseLoadState === 'error') {
    return (
      <div className="community-status community-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {baseLoadError}</p>
      </div>
    );
  }

  const memberTablePeriodLabel = `${periodLabel} · ${month === 'all' ? 'ทั้งช่วง' : 'เฉพาะเดือนที่เลือก'}`;

  return (
    <div className="community-view">
      <CommunityHeader
        communities={communities}
        selectedCommunity={selectedCommunity}
        communityKey={communityKey || ''}
        yearType={yearType}
        year={year}
        month={month}
        onChange={handlePickerChange}
        memberCount={memberCount}
        kpis={kpis}
      />

      <CommunityExportPanel
        communities={communities}
        defaultCommunityKey={communityKey}
        onExport={handleCommunityExport}
        isExporting={isExporting}
      />

      <SubTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      {recordsLoadState === 'loading' ? (
        <div className="community-status">
          <p>กำลังโหลดข้อมูลรายสมาชิก...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              summaryRowsForCommunity={summaryRowsForCommunity}
              trend={trend}
              excludedMonths={excludedMonthsForCommunity}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              periodLabel={periodLabel}
              previousPeriodLabel={previousPeriodLabel}
              completeness={completeness}
              seasonal={seasonal}
              composition={composition}
              memberStats={memberStats}
              retention={retention}
            />
          )}
          {activeTab === 'benchmark' && (
            <BenchmarkTab
              targetCommunityKey={communityKey}
              regionName={selectedCommunity ? selectedCommunity.region : ''}
              periodLabel={periodLabel}
              completeness={completeness}
              incomeRanking={incomeRanking}
              growthRanking={growthRanking}
              economicProfile={economicProfile}
            />
          )}
          {activeTab === 'members' && (
            <MembersTab members={memberTable} periodLabel={memberTablePeriodLabel} />
          )}
        </>
      )}
    </div>
  );
}
