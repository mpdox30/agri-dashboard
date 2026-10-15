// src/pages/ExecutiveSummary.jsx
import { useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlySummary } from '../api/supabase';
import { buildFiscalYearDropdownOptions, buildCalendarYearDropdownOptions } from './fiscalYears';
import { buildExecutiveSummaryData, buildRegionalComparisonRows } from './executiveSummaryData';
import { downloadWorkbook } from '../utils/excelExport';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import Reveal from '../components/ui/Reveal';
import SegmentedControl from '../components/ui/SegmentedControl';
import SegmentBar from '../components/ui/SegmentBar';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { IconTrend, IconWallet, IconCommunity, IconShield } from '../components/ui/kpiIcons';
import BarTrendChart from '../components/BarTrendChart';
import './ExecutiveSummary.css';

const FISCAL_YEAR_OPTIONS = buildFiscalYearDropdownOptions();
const CALENDAR_YEAR_OPTIONS = buildCalendarYearDropdownOptions();
const YEAR_TYPE_OPTIONS = [
  { value: 'fiscal', label: 'ปีงบประมาณ' },
  { value: 'calendar', label: 'ปีปฏิทิน' },
];

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** ลิสต์อันดับที่มีแถบสัดส่วน: แถบยาวตามค่าเทียบกับค่าสูงสุดของลิสต์ และไล่ลำดับการเติมทีละแถว */
function RankList({ title, note, rows, tone = 'up' }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <Reveal>
      <Card className="es-card">
        <div className="es-card__head">
          <h2>{title}</h2>
          {note && <span className="es-card__note">{note}</span>}
        </div>
        {rows.length === 0 ? (
          <p className="es-empty">ยังไม่มีข้อมูลเพียงพอสำหรับจัดอันดับ</p>
        ) : (
          <ol className="es-rank">
            {rows.map((r, i) => (
              <li key={r.key} className="es-rank__row" style={{ '--i': i }}>
                <span className={`es-rank__no es-rank__no--${i + 1}`}>{i + 1}</span>
                <span className="es-rank__name">{r.label}</span>
                <span className="es-rank__bar" aria-hidden="true">
                  <i
                    className={`es-rank__fill${r.value < 0 ? ' is-neg' : ''}${tone === 'blue' ? ' is-blue' : ''}`}
                    style={{ '--w': (Math.abs(r.value) / max) * 100 }}
                  />
                </span>
                <span className="es-rank__val">{r.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </Reveal>
  );
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

  async function handleDownloadRegionalComparison() {
    const { headers, rows } = buildRegionalComparisonRows(communities, allSummaryRows, yearType, year);
    await downloadWorkbook(
      [{ name: 'เปรียบเทียบทั้งระบบ', headers, rows }],
      `เปรียบเทียบทั้งภาค_${summaryData.periodLabel.replace(/\s/g, '')}`
    );
  }

  if (loadState === 'loading') {
    return <LoadingSkeleton variant="community" label="กำลังโหลดข้อมูลรายงานผู้บริหาร..." />;
  }

  if (loadState === 'error') {
    return (
      <div className="es-status es-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      </div>
    );
  }

  const d = summaryData;
  const dataPct = d && d.totalCommunities ? Math.round((d.communitiesWithDataCount / d.totalCommunities) * 100) : 0;
  const fullPct = d && d.totalCommunities ? Math.round((d.completenessCount / d.totalCommunities) * 100) : 0;
  const trendItems = d ? d.monthlyTrend.map((m, i) => ({ key: `${i}-${m.label}`, label: m.label, value: m.netIncome })) : [];
  const regionMax = d ? Math.max(1, ...d.regionStats.map((r) => r.netIncome)) : 1;

  return (
    <div className="executive-summary">
      <header className="es-hero">
        <span className="es-eyebrow">
          <i aria-hidden="true" />
          {d ? d.periodLabel : ''}
        </span>
        <h1>รายงานสรุปผู้บริหาร</h1>
        <p className="es-sub">
          ภาพรวมทั้งโครงการสำหรับนำเสนอผู้บริหาร ดาวน์โหลดเป็น PDF พร้อมนำเสนอ หรือ Excel สำหรับวิเคราะห์เพิ่มเติม
        </p>

        <div className="es-controls">
          <div className="es-field">
            <span className="es-field__label" id="es-yt-label">ประเภทปี</span>
            <SegmentedControl options={YEAR_TYPE_OPTIONS} value={yearType} onChange={handleYearTypeChange} ariaLabel="ประเภทปี" />
          </div>
          <div className="es-field">
            <label className="es-field__label" htmlFor="es-year">ปี</label>
            <select id="es-year" value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="es-actions">
            <button type="button" className="es-btn es-btn--primary" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? 'กำลังสร้างไฟล์...' : '⬇ ดาวน์โหลดรายงาน PDF'}
            </button>
            <button type="button" className="es-btn" onClick={handleDownloadRegionalComparison}>
              ⬇ เปรียบเทียบทั้งภาค/จังหวัด (.xlsx)
            </button>
          </div>
        </div>
      </header>

      {d && (
        <div className="es-preview">
          <div className="es-kpis">
            <StatCard
              label="รายได้สุทธิรวม"
              value={d.totalNetIncome}
              format={formatInteger}
              unit="บาท"
              note={`ขาย ${formatBaht(d.totalSale)} บวกแบ่งปัน ${formatBaht(d.totalSharing)} หักซื้อ ${formatBaht(d.totalPurchase)}`}
              icon={<IconTrend />}
              color="green"
            />
            <StatCard
              label="ลดรายจ่ายครัวเรือนรวม"
              value={d.totalHousehold}
              format={formatInteger}
              unit="บาท"
              note="ไม่รวมในรายได้สุทธิ แสดงแยกเพื่อสะท้อนประโยชน์ต่อครัวเรือน"
              icon={<IconWallet />}
              color="terracotta"
              delay={70}
            />
            <StatCard
              label="ชุมชนที่มีข้อมูล"
              value={d.communitiesWithDataCount}
              format={formatInteger}
              unit={`จาก ${d.totalCommunities} ชุมชน`}
              note={`ครอบคลุม ${dataPct}% ของทุกชุมชน`}
              icon={<IconCommunity />}
              color="sage"
              delay={140}
            />
            <StatCard
              label="ข้อมูลครบทุกเดือน"
              value={d.completenessCount}
              format={formatInteger}
              unit={`จาก ${d.totalCommunities} ชุมชน`}
              note={`${fullPct}% ส่งข้อมูลครบทั้งช่วง`}
              icon={<IconShield />}
              color="ink"
              delay={210}
            />
          </div>

          <Reveal className="es-section">
            <div className="es-section__head">
              <h2>แนวโน้มรายได้สุทธิรายเดือน</h2>
              <span className="es-section__note">หน่วย: บาท (รวมทุกชุมชน)</span>
            </div>
            <BarTrendChart
              items={trendItems}
              ariaLabel={`รายได้สุทธิรวมรายเดือน ${d.periodLabel}`}
              tableLabel="เดือน"
              legend="แท่งลายเส้นหมายถึงเดือนที่ยังไม่มีข้อมูล · ชี้หรือแตะที่แท่งเพื่อดูค่าเต็ม"
            />
          </Reveal>

          <div className="es-grid es-grid--2">
            <Reveal>
              <Card className="es-card">
                <div className="es-card__head">
                  <h2>ที่มาของรายได้</h2>
                </div>
                <SegmentBar
                  segments={[
                    { key: 'sale', value: d.totalSale, tone: 'up', label: 'ขาย' },
                    { key: 'sharing', value: d.totalSharing, tone: 'flat', label: 'แบ่งปันในชุมชน' },
                    { key: 'purchase', value: d.totalPurchase, tone: 'down', label: 'ซื้อ (หักออก)' },
                  ]}
                />
                <dl className="es-legend">
                  <div><dt><i className="es-dot es-dot--up" />ขาย</dt><dd>{formatBaht(d.totalSale)} ฿</dd></div>
                  <div><dt><i className="es-dot es-dot--flat" />แบ่งปันในชุมชน</dt><dd>{formatBaht(d.totalSharing)} ฿</dd></div>
                  <div><dt><i className="es-dot es-dot--down" />ซื้อ (หักออก)</dt><dd>{formatBaht(d.totalPurchase)} ฿</dd></div>
                </dl>
              </Card>
            </Reveal>

            <Reveal delay={80}>
              <Card className="es-card">
                <div className="es-card__head">
                  <h2>ความครบถ้วนของข้อมูล</h2>
                </div>
                <div className="es-meter">
                  <div className="es-meter__row">
                    <span>มีข้อมูลอย่างน้อยหนึ่งเดือน</span>
                    <b>{d.communitiesWithDataCount}/{d.totalCommunities}</b>
                  </div>
                  <span className="es-meter__track"><i style={{ '--w': dataPct }} /></span>
                  <div className="es-meter__row">
                    <span>ข้อมูลครบทุกเดือนในช่วง</span>
                    <b>{d.completenessCount}/{d.totalCommunities}</b>
                  </div>
                  <span className="es-meter__track"><i className="is-blue" style={{ '--w': fullPct }} /></span>
                </div>
              </Card>
            </Reveal>
          </div>

          <div className="es-grid es-grid--2">
            <RankList
              title="รายได้สุทธิสูงสุด 5 อันดับ"
              note="บาท"
              rows={d.top5Income.map((c) => ({ key: c.community_key, label: `ชุมชน${c.community_key}`, value: c.netIncome, text: `${formatBaht(c.netIncome)} ฿` }))}
            />
            <RankList
              title="การเติบโตสูงสุด 5 อันดับ"
              note="เทียบช่วงก่อนหน้า"
              tone="blue"
              rows={d.top5Growth.map((c) => ({ key: c.community_key, label: `ชุมชน${c.community_key}`, value: c.growthPct, text: `${c.growthPct > 0 ? '+' : ''}${c.growthPct.toFixed(1)}%` }))}
            />
          </div>

          {d.regionStats.length > 0 && (
            <Reveal>
              <Card className="es-card">
                <div className="es-card__head">
                  <h2>รายได้สุทธิรายภาค</h2>
                  <span className="es-card__note">จำนวนชุมชนที่มีข้อมูล / ทั้งหมด</span>
                </div>
                <ol className="es-rank">
                  {d.regionStats.map((r, i) => (
                    <li key={r.region} className="es-rank__row es-rank__row--region" style={{ '--i': i }}>
                      <span className="es-rank__name">{r.region}</span>
                      <span className="es-rank__sub">{r.withDataCount}/{r.communityCount} ชุมชน</span>
                      <span className="es-rank__bar" aria-hidden="true">
                        <i className="es-rank__fill" style={{ '--w': (r.netIncome / regionMax) * 100 }} />
                      </span>
                      <span className="es-rank__val">{formatBaht(r.netIncome)} ฿</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}
