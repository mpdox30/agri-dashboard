// src/pages/ExecutiveSummary.jsx
import { useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlySummary } from '../api/appsScript';
import { buildFiscalYearDropdownOptions, buildCalendarYearDropdownOptions } from './fiscalYears';
import { buildExecutiveSummaryData, buildRegionalComparisonRows } from './executiveSummaryData';
import { downloadWorkbook } from '../utils/excelExport';
import './ExecutiveSummary.css';

const FISCAL_YEAR_OPTIONS = buildFiscalYearDropdownOptions();
const CALENDAR_YEAR_OPTIONS = buildCalendarYearDropdownOptions();

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

export default function ExecutiveSummary() {
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [allSummaryRows, setAllSummaryRows] = useState([]);
  const [yearType, setYearType] = useState('fiscal');
  const [year, setYear] = useState('68-69');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState('loading');
      try {
        const [communitiesData, summaryData] = await Promise.all([getCommunities(), getMonthlySummary()]);
        if (cancelled) return;
        setCommunities(communitiesData);
        setAllSummaryRows(summaryData);
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || String(err));
        setLoadState('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = yearType === 'fiscal' ? FISCAL_YEAR_OPTIONS : CALENDAR_YEAR_OPTIONS;

  const summaryData = useMemo(
    () => (loadState === 'ready' ? buildExecutiveSummaryData(communities, allSummaryRows, yearType, year) : null),
    [communities, allSummaryRows, yearType, year, loadState]
  );

  function handleYearTypeChange(nextType) {
    setYearType(nextType);
    setYear(nextType === 'fiscal' ? FISCAL_YEAR_OPTIONS[0].value : CALENDAR_YEAR_OPTIONS[0].value);
  }

  async function handleDownloadPdf() {
    if (!summaryData) return;
    setIsGeneratingPdf(true);
    try {
      // import แบบ dynamic เฉพาะตอนกดดาวน์โหลดจริง — jsPDF + ฟอนต์ฝังตัวมีขนาดใหญ่
      // ไม่อยากให้โหลดมาเปล่า ๆ ตั้งแต่เปิดหน้านี้ถ้ายังไม่ได้กดดาวน์โหลด
      const { generateExecutiveSummaryPDF } = await import('../utils/pdfExport');
      generateExecutiveSummaryPDF(summaryData);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleDownloadRegionalComparison() {
    const { headers, rows } = buildRegionalComparisonRows(communities, allSummaryRows, yearType, year);
    downloadWorkbook(
      [{ name: 'เปรียบเทียบทั้งระบบ', headers, rows }],
      `เปรียบเทียบทั้งภาค_${summaryData.periodLabel.replace(/\s/g, '')}`
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="es-status">
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="es-status es-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="executive-summary">
      <div className="es-hero">
        <h1>รายงานสรุปผู้บริหาร</h1>
        <p className="es-sub">
          ภาพรวมทั้งโครงการสำหรับนำเสนอผู้บริหาร — ดาวน์โหลดเป็น PDF พร้อมนำเสนอ หรือ Excel
          สำหรับวิเคราะห์เพิ่มเติม
        </p>

        <div className="es-picker-row">
          <div className="es-field">
            <label>ประเภทปี</label>
            <div className="seg-toggle">
              <button type="button" className={yearType === 'fiscal' ? 'active' : ''} onClick={() => handleYearTypeChange('fiscal')}>
                ปีงบประมาณ
              </button>
              <button type="button" className={yearType === 'calendar' ? 'active' : ''} onClick={() => handleYearTypeChange('calendar')}>
                ปีปฏิทิน
              </button>
            </div>
          </div>
          <div className="es-field">
            <label>ปี</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="es-download-row">
          <button type="button" className="es-download-btn es-download-btn--primary" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? 'กำลังสร้างไฟล์...' : '⬇ ดาวน์โหลดรายงาน PDF'}
          </button>
          <button type="button" className="es-download-btn" onClick={handleDownloadRegionalComparison}>
            ⬇ เปรียบเทียบทั้งภาค/จังหวัด (.xlsx)
          </button>
        </div>
      </div>

      {summaryData && (
        <div className="es-preview">
          <div className="es-kpi-row">
            <div className="es-kpi-card">
              <div className="es-kpi-label">รายได้สุทธิรวม</div>
              <div className="es-kpi-value">{formatBaht(summaryData.totalNetIncome)} ฿</div>
            </div>
            <div className="es-kpi-card">
              <div className="es-kpi-label">ลดรายจ่ายครัวเรือนรวม</div>
              <div className="es-kpi-value">{formatBaht(summaryData.totalHousehold)} ฿</div>
            </div>
            <div className="es-kpi-card">
              <div className="es-kpi-label">ชุมชนที่มีข้อมูล</div>
              <div className="es-kpi-value">
                {summaryData.communitiesWithDataCount}/{summaryData.totalCommunities}
              </div>
            </div>
            <div className="es-kpi-card">
              <div className="es-kpi-label">ชุมชนที่มีข้อมูลครบทุกเดือน</div>
              <div className="es-kpi-value">
                {summaryData.completenessCount}/{summaryData.totalCommunities}
              </div>
            </div>
          </div>

          <div className="es-rank-grid">
            <div className="es-rank-card">
              <div className="es-rank-title">รายได้สุทธิสูงสุด 5 อันดับ</div>
              {summaryData.top5Income.map((c, i) => (
                <div className="es-rank-row" key={c.community_key}>
                  <span>{i + 1}. ชุมชน{c.community_key}</span>
                  <span>{formatBaht(c.netIncome)} ฿</span>
                </div>
              ))}
            </div>
            <div className="es-rank-card">
              <div className="es-rank-title">การเติบโตสูงสุด 5 อันดับ</div>
              {summaryData.top5Growth.map((c, i) => (
                <div className="es-rank-row" key={c.community_key}>
                  <span>{i + 1}. ชุมชน{c.community_key}</span>
                  <span>{c.growthPct > 0 ? '+' : ''}{c.growthPct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
