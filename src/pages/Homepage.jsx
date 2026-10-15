// src/pages/Homepage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlySummary } from '../api/supabase';
import FilterBar from '../components/FilterBar';
import KpiRow from '../components/KpiRow';
import LiveHeadline from '../components/LiveHeadline';
import ChangeSplitCard from '../components/ChangeSplitCard';
import MyCommunityCard from '../components/MyCommunityCard';
import FloatingNav from '../components/FloatingNav';
import DigestCard from '../components/DigestCard';
import ShareCardButton from '../components/ShareCardButton';
import PresentationMode from '../components/PresentationMode';
import useMyCommunity from '../components/useMyCommunity';
import BarTrendChart from '../components/BarTrendChart';
import ProvinceGrid from '../components/ProvinceGrid';
import ProvinceMapExplorer from '../components/ProvinceMapExplorer';
import {
  filterSummaryRows,
  aggregateTotals,
  buildMonthlySeries,
  aggregateByProvince,
  buildOverdueReport,
  buildHomepageExportSheets,
  findLatestDataMonth,
  buildYearOverYearComparison,
  splitCommunitiesByChange,
} from './homepageAggregations';
import { formatMonthLabel, getPreviousPeriod } from './fiscalYears';
import { cleanAllSummaryRows } from './communityAggregations';
import { buildDigest } from './digestData';
import { summarizeCommunity, buildVisitSnapshot, describeSinceLastVisit } from './myCommunityData';
import { downloadWorkbook } from '../utils/excelExport';
import './Homepage.css';

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatBahtCompact(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

// ส่วนต่างๆ ของหน้าสำหรับแถบนำทางลอย (id ต้องตรงกับ id ของ element ด้านล่าง)
const NAV_ITEMS = [
  { id: 'sec-overview', label: 'ภาพรวม' },
  { id: 'sec-trend', label: 'แนวโน้ม' },
  { id: 'sec-map', label: 'แผนที่' },
  { id: 'sec-overdue', label: 'ยังไม่ส่งข้อมูล' },
];

const DEFAULT_FILTERS = {
  yearType: 'fiscal',
  year: '68-69',
  month: 'all',
  region: 'all',
  province: 'all',
  community: 'all',
};

export default function Homepage() {
  const [communities, setCommunities] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [presenting, setPresenting] = useState(false);
  const exitPresenting = useCallback(() => setPresenting(false), []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadState('loading');
      try {
        // ดึงทั้ง communities และ monthly_summary (ทุกชุมชน ไม่ระบุ community_key)
        // พร้อมกัน เพราะหน้านี้ต้องใช้ข้อมูลทั้งระบบมาคำนวณภาพรวม/รายจังหวัด
        const [communitiesData, summaryData] = await Promise.all([
          getCommunities(),
          getMonthlySummary(), // ไม่ส่ง community_key = ดึงทุกชุมชน
        ]);
        if (cancelled) return;
        setCommunities(communitiesData);
        setSummaryRows(summaryData);
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || String(err));
        setLoadState('error');
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const communityToProvince = useMemo(
    () => new Map(communities.map((c) => [c.community_key, c.province])),
    [communities]
  );

  const communityToRegion = useMemo(
    () => new Map(communities.map((c) => [c.community_key, c.region])),
    [communities]
  );

  const regions = useMemo(() => {
    const set = new Set(communities.map((c) => c.region).filter(Boolean));
    return Array.from(set).sort();
  }, [communities]);

  const provinces = useMemo(() => {
    const set = new Set(communities.map((c) => c.province).filter(Boolean));
    return Array.from(set).sort();
  }, [communities]);

  const filteredRows = useMemo(
    () => filterSummaryRows(summaryRows, { ...filters, communityToRegion, communityToProvince }),
    [summaryRows, filters, communityToRegion, communityToProvince]
  );

  // จำนวนชุมชน "ในขอบเขตที่กำลังดูอยู่" (ตามตัวกรองภาค/จังหวัด/ชุมชน) ใช้เป็นตัวหารของ
  // "ชุมชนที่มีข้อมูล X/Y" — ถ้าใช้ 85 (ทั้งระบบ) เสมอ ตอนกรองเหลือภาคเดียวจะดูเข้าใจผิดว่า
  // ชุมชนส่วนใหญ่ในระบบไม่มีข้อมูล ทั้งที่จริงแค่ไม่ได้อยู่ในภาคที่เลือกดู
  const communitiesInScope = useMemo(() => {
    return communities.filter((c) => {
      if (filters.community !== 'all') return c.community_key === filters.community;
      if (filters.province !== 'all' && c.province !== filters.province) return false;
      if (filters.region !== 'all' && c.region !== filters.region) return false;
      return true;
    });
  }, [communities, filters.region, filters.province, filters.community]);

  const currentTotals = useMemo(
    () => aggregateTotals(filteredRows, communitiesInScope.length),
    [filteredRows, communitiesInScope.length]
  );

  const monthlySeries = useMemo(
    () => buildMonthlySeries(summaryRows, { ...filters, communityToRegion, communityToProvince }),
    [summaryRows, filters, communityToRegion, communityToProvince]
  );

  // แถวข้อมูลสำหรับมุมมองรายจังหวัด: อิงตัวกรองปี/เดือน/ภาคเดียวกัน แต่ไม่ล็อกตามจังหวัด/ชุมชน
  // ที่เลือกไว้ (เพื่อให้ยังเห็นภาพรวมหลายจังหวัดแม้กำลัง drill-down อยู่ที่จังหวัดหนึ่ง —
  // ถ้าเลือกภาคไว้ จะยังกรองเหลือแค่จังหวัดในภาคนั้น เพราะภาคถือเป็นขอบเขตกว้างที่ตั้งใจ
  // เลือกไว้ ไม่ใช่แค่ "กำลังจะดูจังหวัดเดียว" แบบจังหวัด/ชุมชน)
  const provinceViewRows = useMemo(
    () =>
      filterSummaryRows(summaryRows, {
        ...filters,
        province: 'all',
        community: 'all',
        communityToRegion,
        communityToProvince,
      }),
    [summaryRows, filters, communityToRegion, communityToProvince]
  );

  const provinceTotals = useMemo(
    () => aggregateByProvince(provinceViewRows, communities),
    [provinceViewRows, communities]
  );

  // แผนที่ใช้แถวของทั้งปี (ไม่ล็อกเดือนตามตัวกรอง) เพื่อให้แถบเวลาเลื่อนดูได้ทุกเดือนของปีที่เลือก
  const mapRows = useMemo(
    () =>
      filterSummaryRows(summaryRows, {
        ...filters,
        month: 'all',
        province: 'all',
        community: 'all',
        communityToRegion,
        communityToProvince,
      }),
    [summaryRows, filters, communityToRegion, communityToProvince]
  );

  const kpiNetSeries = useMemo(() => monthlySeries.map((m) => m.netIncome), [monthlySeries]);
  const kpiHouseholdSeries = useMemo(() => monthlySeries.map((m) => m.householdReduction), [monthlySeries]);
  const monthlyBarItems = useMemo(
    () => monthlySeries.map((m) => ({ key: m.key || m.label, label: m.label, value: m.netIncome })),
    [monthlySeries]
  );

  const latestDataMonth = useMemo(() => findLatestDataMonth(summaryRows), [summaryRows]);

  // เทียบกับปีก่อนแบบ "เดือนเดียวกัน" ใช้ข้อมูลที่ตัดเดือนที่ยังไม่ได้กรอกจริงออกแล้ว
  const cleanedSummaryRows = useMemo(() => cleanAllSummaryRows(summaryRows), [summaryRows]);

  const comparison = useMemo(() => {
    if (filters.year === 'all') return null;
    const previousYear = getPreviousPeriod(filters.yearType, filters.year);
    if (!previousYear) return null;
    const scope = { ...filters, communityToRegion, communityToProvince };
    const result = buildYearOverYearComparison(
      filterSummaryRows(cleanedSummaryRows, scope),
      filterSummaryRows(cleanedSummaryRows, { ...scope, year: previousYear })
    );
    return { ...result, split: splitCommunitiesByChange(result.communities) };
  }, [cleanedSummaryRows, filters, communityToRegion, communityToProvince]);

  const digestItems = useMemo(
    () =>
      buildDigest({
        comparison,
        communitiesInScope,
        cleanedRows: cleanedSummaryRows,
        latestMonth: latestDataMonth,
        provinceTotals,
      }),
    [comparison, communitiesInScope, cleanedSummaryRows, latestDataMonth, provinceTotals]
  );

  // ชุมชนของฉัน + ตั้งแต่ครั้งก่อนที่เข้ามา (เก็บในเครื่องผู้ชมเท่านั้น)
  const currentVisitSnapshot = useMemo(
    () => (cleanedSummaryRows.length > 0 ? buildVisitSnapshot(cleanedSummaryRows, latestDataMonth) : null),
    [cleanedSummaryRows, latestDataMonth]
  );
  const { myKey, setMyKey, previousVisit } = useMyCommunity(currentVisitSnapshot);

  const myCommunitySummary = useMemo(
    () =>
      myKey
        ? summarizeCommunity({
            communityKey: myKey,
            rows: cleanedSummaryRows,
            communities,
            yearType: filters.yearType,
            year: filters.year,
          })
        : null,
    [myKey, cleanedSummaryRows, communities, filters.yearType, filters.year]
  );

  const sinceLastVisit = useMemo(
    () => (currentVisitSnapshot ? describeSinceLastVisit(previousVisit, currentVisitSnapshot, myKey, currentVisitSnapshot.at) : null),
    [previousVisit, currentVisitSnapshot, myKey]
  );

  const overdueReport = useMemo(
    () => buildOverdueReport(communities, summaryRows, currentMonthString()),
    [communities, summaryRows]
  );

  function handleSelectProvince(province) {
    const matchingCommunity = communities.find((c) => c.province === province);
    setFilters((prev) => ({
      ...prev,
      region: matchingCommunity ? matchingCommunity.region : prev.region,
      province,
      community: 'all',
    }));
  }

  function handleFocusCommunity(communityKey) {
    const match = communities.find((c) => c.community_key === communityKey);
    if (!match) return;
    setFilters((prev) => ({ ...prev, region: match.region, province: match.province, community: communityKey }));
  }

  function buildOverviewShareOptions() {
    const delta = comparison ? comparison.netIncomePct : null;
    const direction = delta === null ? 'flat' : Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';
    const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '—';
    const split = comparison ? comparison.split : null;
    return {
      title: `ภาพรวมโครงการ · ${yearLabel}`,
      label: 'รายได้สุทธิรวมทุกชุมชนที่เลือก',
      value: formatBahtCompact(currentTotals.netIncome),
      unit: 'บาท',
      deltaText: delta === null ? '' : `${arrow} ${Math.abs(delta).toFixed(1)}% จากเดือนเดียวกันของปีก่อน`,
      deltaTone: direction,
      lines: [
        `${formatBahtCompact(currentTotals.communitiesWithData)} จาก ${formatBahtCompact(currentTotals.totalCommunities)} ชุมชนส่งข้อมูลแล้ว`,
        split && split.total > 0
          ? `เทียบปีก่อน: เพิ่มขึ้น ${split.up} · ทรงตัว ${split.flat} · ลดลง ${split.down} ชุมชน`
          : '',
      ].filter(Boolean),
      series: monthlySeries.map((m) => m.netIncome),
      footer: latestDataMonth ? `ข้อมูลล่าสุด: ${formatMonthLabel(latestDataMonth)} ${Number(latestDataMonth.split('-')[0]) + 543}` : '',
    };
  }

  function handleDownload() {
    const { sheets, periodLabel } = buildHomepageExportSheets(
      communities,
      summaryRows,
      filters.yearType,
      filters.year
    );
    downloadWorkbook(sheets, `ภาพรวมโครงการ_${periodLabel.replace(/\s/g, '')}`);
  }

  if (loadState === 'loading') {
    return (
      <div className="homepage-status">
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="homepage-status homepage-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
        <p className="homepage-status__hint">
          ตรวจสอบว่า APPS_SCRIPT_URL ใน src/api/appsScript.js ถูกตั้งค่าแล้ว และ Apps Script
          deploy เป็น Web app พร้อมเปิดสิทธิ์ "Anyone" แล้ว
        </p>
      </div>
    );
  }

  const yearLabel =
    filters.yearType === 'fiscal' ? `ปีงบ ${filters.year}` : `ปี ${filters.year}`;

  return (
    <div className="homepage">
      <div className="homepage__hero" id="sec-overview">
        <h1>ภาพรวมโครงการ</h1>
        <p className="homepage__sub">
          รวบรวมจาก {communities.length} ชุมชน/กลุ่ม ครอบคลุมข้อมูลตั้งแต่ปีงบประมาณ 2565
          ถึง 2569 ตามแนวทางเกษตรทฤษฎีใหม่
        </p>

        <LiveHeadline
          scopeLabel={yearLabel}
          communitiesWithData={currentTotals.communitiesWithData}
          totalCommunities={currentTotals.totalCommunities}
          netIncome={currentTotals.netIncome}
          latestMonth={latestDataMonth}
        />

        <FilterBar
          yearType={filters.yearType}
          year={filters.year}
          month={filters.month}
          region={filters.region}
          province={filters.province}
          community={filters.community}
          regions={regions}
          provinces={provinces}
          communities={communities}
          onChange={setFilters}
        />

        <div className="homepage__download-row">
          <button type="button" className="homepage__download-btn" onClick={handleDownload}>
            ⬇ ดาวน์โหลดข้อมูล ({yearLabel})
          </button>
          <ShareCardButton
            buildOptions={buildOverviewShareOptions}
            filename="ภาพรวมโครงการ.png"
            shareText={`ภาพรวมโครงการ ${yearLabel}`}
            label="บันทึกภาพรวมเป็นรูป"
          />
          <button type="button" className="homepage__present-btn" onClick={() => setPresenting(true)}>
            ▶ โหมดนำเสนอ
          </button>
          <span className="homepage__download-note">
            ไฟล์ .xlsx — รวมทั้งระบบ (ไม่จำกัดตามจังหวัด/ชุมชนที่กรองไว้ด้านบน)
          </span>
        </div>

        <KpiRow
          currentTotals={currentTotals}
          netDelta={comparison ? comparison.netIncomePct : null}
          householdDelta={comparison ? comparison.householdPct : null}
          deltaSuffix="จากเดือนเดียวกันของปีก่อน"
          dataQualityFlagCount={0}
          netSeries={kpiNetSeries}
          householdSeries={kpiHouseholdSeries}
        />

        {comparison && <ChangeSplitCard split={comparison.split} pairedCount={comparison.pairedCount} />}

        <DigestCard items={digestItems} onFocusCommunity={handleFocusCommunity} />

        <MyCommunityCard
          communities={communities}
          myKey={myKey}
          onChangeMyKey={setMyKey}
          summary={myCommunitySummary}
          scopeLabel={yearLabel}
          since={sinceLastVisit}
          onFocusCommunity={handleFocusCommunity}
          latestMonth={latestDataMonth}
        />
      </div>

      <div className="homepage__section" id="sec-trend">
        <div className="homepage__section-head">
          <h2>แนวโน้มรายเดือน — {yearLabel}</h2>
          <span className="homepage__section-note">หน่วย: บาท (รายได้สุทธิ)</span>
        </div>
        <BarTrendChart
          items={monthlyBarItems}
          ariaLabel={`รายได้สุทธิรายเดือน ${yearLabel}`}
          tableLabel="เดือน"
          legend="แท่งลายเส้นหมายถึงเดือนที่ยังไม่มีข้อมูลกรอกเข้ามา · ชี้หรือแตะที่แท่งเพื่อดูค่าเต็ม"
        />
      </div>

      <div className="homepage__section" id="sec-map">
        <div className="homepage__section-head">
          <h2>รายได้ตามจังหวัด — {yearLabel}</h2>
          <span className="homepage__section-note">
            คลิกจังหวัดเพื่อกรองข้อมูลด้านบนตามจังหวัดนั้น · แสดง {provinceTotals.length} จังหวัด
          </span>
        </div>
        <ProvinceMapExplorer
          rows={mapRows}
          communities={communities}
          selectedProvince={filters.province}
          onSelectProvince={handleSelectProvince}
        />
        <ProvinceGrid provinceTotals={provinceTotals} onSelectProvince={handleSelectProvince} />
      </div>

      <div className="homepage__section" id="sec-overdue">
        <div className="homepage__section-head">
          <h2>ชุมชนที่ยังไม่ส่งข้อมูลเดือน {formatMonthLabel(currentMonthString())}</h2>
          <span className="homepage__section-note">{overdueReport.length} / {communities.length} ชุมชน</span>
        </div>
        <p className="homepage__overdue-note">
          อ้างอิงเดือนปฏิทินปัจจุบันจริง (ไม่ใช่ตัวกรองด้านบน) · คาดการณ์รายได้จากค่าเฉลี่ยเดือน
          เดียวกันของปีก่อน ๆ ที่มีข้อมูลจริง (ไม่รวมเดือนที่ตัดออกเพราะ 0 ต่อเนื่องนาน)
        </p>
        {overdueReport.length === 0 ? (
          <div className="homepage__overdue-empty">ทุกชุมชนส่งข้อมูลเดือนนี้แล้ว</div>
        ) : (
          <div className="homepage__overdue-table-scroll">
            <table className="homepage__overdue-table">
              <thead>
                <tr>
                  <th>ชุมชน</th>
                  <th>จังหวัด</th>
                  <th>ส่งข้อมูลล่าสุดเมื่อ</th>
                  <th className="num">คาดการณ์รายได้เดือนนี้</th>
                </tr>
              </thead>
              <tbody>
                {overdueReport.map((o) => (
                  <tr key={o.community_key}>
                    <td>ชุมชน{o.community_key}</td>
                    <td>{o.province}</td>
                    <td>{o.lastReportedMonth ? formatMonthLabel(o.lastReportedMonth) + ' ' + o.lastReportedMonth.split('-')[0] : 'ไม่เคยส่งข้อมูล'}</td>
                    <td className="num">
                      {o.forecast ? (
                        <>
                          {formatBahtCompact(o.forecast.average)} ฿
                          <span className="homepage__overdue-sample"> (เฉลี่ยจาก {o.forecast.sampleSize} ปี)</span>
                        </>
                      ) : (
                        <span className="homepage__overdue-sample">ไม่มีข้อมูลเพียงพอสำหรับคาดการณ์</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FloatingNav items={NAV_ITEMS} />

      {presenting && (
        <PresentationMode
          onExit={exitPresenting}
          slides={[
            {
              key: 'summary',
              title: `ภาพรวมโครงการ ${yearLabel}`,
              node: (
                <>
                  <LiveHeadline
                    scopeLabel={yearLabel}
                    communitiesWithData={currentTotals.communitiesWithData}
                    totalCommunities={currentTotals.totalCommunities}
                    netIncome={currentTotals.netIncome}
                    latestMonth={latestDataMonth}
                  />
                  <KpiRow
                    currentTotals={currentTotals}
                    netDelta={comparison ? comparison.netIncomePct : null}
                    householdDelta={comparison ? comparison.householdPct : null}
                    deltaSuffix="จากเดือนเดียวกันของปีก่อน"
                    dataQualityFlagCount={0}
                    netSeries={kpiNetSeries}
                    householdSeries={kpiHouseholdSeries}
                  />
                  {comparison && <ChangeSplitCard split={comparison.split} pairedCount={comparison.pairedCount} />}
                </>
              ),
            },
            { key: 'trend', title: `แนวโน้มรายเดือน ${yearLabel}`, node: <BarTrendChart items={monthlyBarItems} ariaLabel={`รายได้สุทธิรายเดือน ${yearLabel}`} tableLabel="เดือน" /> },
            {
              key: 'map',
              title: `รายได้ตามจังหวัด ${yearLabel}`,
              node: (
                <ProvinceMapExplorer
                  rows={mapRows}
                  communities={communities}
                  selectedProvince={filters.province}
                  onSelectProvince={handleSelectProvince}
                />
              ),
            },
            {
              key: 'digest',
              title: 'สัญญาณจากข้อมูล',
              node: <DigestCard items={digestItems} onFocusCommunity={handleFocusCommunity} />,
            },
          ]}
        />
      )}
    </div>
  );
}
