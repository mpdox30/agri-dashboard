// src/pages/Homepage.jsx
import { useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlySummary } from '../api/appsScript';
import FilterBar from '../components/FilterBar';
import KpiRow from '../components/KpiRow';
import TrendChart from '../components/TrendChart';
import ProvinceGrid from '../components/ProvinceGrid';
import {
  filterSummaryRows,
  aggregateTotals,
  buildMonthlySeries,
  aggregateByProvince,
  buildOverdueReport,
  buildHomepageExportSheets,
} from './homepageAggregations';
import { formatMonthLabel } from './fiscalYears';
import { downloadWorkbook } from '../utils/excelExport';
import './Homepage.css';

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatBahtCompact(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

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

  const provinceTotals = useMemo(() => {
    // กราฟ/กริดรายจังหวัดอิงตามตัวกรองปี/เดือน/ภาคเดียวกัน แต่ไม่ล็อกตามจังหวัด/ชุมชน
    // ที่เลือกไว้ (เพื่อให้ยังเห็นภาพรวมหลายจังหวัดแม้กำลัง drill-down อยู่ที่จังหวัดหนึ่ง —
    // ถ้าเลือกภาคไว้ จะยังกรองเหลือแค่จังหวัดในภาคนั้น เพราะภาคถือเป็นขอบเขตกว้างที่ตั้งใจ
    // เลือกไว้ ไม่ใช่แค่ "กำลังจะดูจังหวัดเดียว" แบบจังหวัด/ชุมชน)
    const rowsForProvinceView = filterSummaryRows(summaryRows, {
      ...filters,
      province: 'all',
      community: 'all',
      communityToRegion,
      communityToProvince,
    });
    return aggregateByProvince(rowsForProvinceView, communities);
  }, [summaryRows, filters, communities, communityToRegion, communityToProvince]);

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
      <div className="homepage__hero">
        <h1>ภาพรวมโครงการ</h1>
        <p className="homepage__sub">
          รวบรวมจาก {communities.length} ชุมชน/กลุ่ม ครอบคลุมข้อมูลตั้งแต่ปีงบประมาณ 2565
          ถึง 2569 ตามแนวทางเกษตรทฤษฎีใหม่
        </p>

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
          <span className="homepage__download-note">
            ไฟล์ .xlsx — รวมทั้งระบบ (ไม่จำกัดตามจังหวัด/ชุมชนที่กรองไว้ด้านบน)
          </span>
        </div>

        <KpiRow
          currentTotals={currentTotals}
          previousTotals={null}
          dataQualityFlagCount={0}
        />
      </div>

      <div className="homepage__section">
        <div className="homepage__section-head">
          <h2>แนวโน้มรายเดือน — {yearLabel}</h2>
          <span className="homepage__section-note">
            หน่วย: ล้านบาท · แท่งสีเทาหมายถึงเดือนที่ยังไม่มีข้อมูลกรอกเข้ามา
          </span>
        </div>
        <TrendChart months={monthlySeries} />
      </div>

      <div className="homepage__section">
        <div className="homepage__section-head">
          <h2>รายได้ตามจังหวัด — {yearLabel}</h2>
          <span className="homepage__section-note">
            คลิกจังหวัดเพื่อกรองข้อมูลด้านบนตามจังหวัดนั้น · แสดง {provinceTotals.length} จังหวัด
          </span>
        </div>
        <ProvinceGrid provinceTotals={provinceTotals} onSelectProvince={handleSelectProvince} />
      </div>

      <div className="homepage__section">
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
    </div>
  );
}
