// src/pages/communityTabs/OverviewTab.jsx
import { FISCAL_YEAR_DISPLAY_LABEL, FISCAL_YEAR_RANGES, enumerateMonths, formatMonthLabel } from '../fiscalYears';
import './OverviewTab.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   summaryRowsForCommunity: monthly_summary rows ของชุมชนนี้ (ทุกปี) — ผ่านการตัดเดือนที่
 *     น่าจะไม่ได้กรอกข้อมูลจริงออกแล้ว (ดู excludeLikelyUnenteredMonths ใน
 *     communityAggregations.js) ดังนั้นเดือนที่ "ครบ" ในแผงนี้คือเดือนที่มีข้อมูลจริง ๆ
 *     ไม่ใช่แค่มีแถวอยู่เฉย ๆ
 *   trend: ผลลัพธ์จาก buildFourYearTrend()
 *   excludedMonths: Set ของเดือน (YYYY-MM) ที่ถูกตัดออกเพราะค่าเป็น 0 ต่อเนื่องยาวเกินไป
 *     (เพื่ออธิบายให้เห็นว่าทำไมปีที่ "ดูเหมือนมีแถวครบ" ถึงไม่ถูกนับว่าครบ)
 */
export default function OverviewTab({ summaryRowsForCommunity, trend, excludedMonths }) {
  const maxNetIncome = Math.max(
    1,
    ...trend.map((t) => (t.totals ? Math.abs(t.totals.netIncome) : 0))
  );

  const excludedMonthsList = excludedMonths ? Array.from(excludedMonths).sort() : [];

  return (
    <>
      <div className="section">
        <div className="section-head">
          <h2>ความครบถ้วนของข้อมูล</h2>
          <span className="note">จำนวนเดือนที่มีข้อมูลกรอกแล้ว จาก 12 เดือนที่คาดไว้ ต่อปีงบ</span>
        </div>
        <div className="completeness-panel">
          {Object.keys(FISCAL_YEAR_RANGES).map((yearKey) => {
            const range = FISCAL_YEAR_RANGES[yearKey];
            const expectedMonths = enumerateMonths(range.start, range.end);
            const presentMonths = new Set(
              summaryRowsForCommunity
                .filter((r) => r.month >= range.start && r.month <= range.end)
                .map((r) => r.month)
            );
            const completedCount = expectedMonths.filter((m) => presentMonths.has(m)).length;
            const isComplete = completedCount === expectedMonths.length;
            return (
              <div className="completeness-row" key={yearKey}>
                <span className="completeness-year">{FISCAL_YEAR_DISPLAY_LABEL[yearKey]}</span>
                <span className="completeness-bar-track">
                  <span
                    className="completeness-bar-fill"
                    style={{ width: `${(completedCount / expectedMonths.length) * 100}%` }}
                  />
                </span>
                <span className="completeness-count">
                  {completedCount}/{expectedMonths.length} เดือน
                </span>
                <span className={isComplete ? 'completeness-tag complete' : 'completeness-tag partial'}>
                  {isComplete ? 'ครบ' : 'ไม่ครบ'}
                </span>
              </div>
            );
          })}
        </div>
        {excludedMonthsList.length > 0 && (
          <div className="completeness-footnote">
            ⚑ ตัดออกจาก "มีข้อมูล" ด้านบนแล้ว {excludedMonthsList.length} เดือน เพราะค่าทุกยอด
            (ขาย ซื้อ แบ่งปัน ลดรายจ่าย) เป็น 0 ต่อเนื่องตั้งแต่ 4 เดือนขึ้นไป — ถือว่าเทียบเท่า
            ไม่ได้กรอกข้อมูลจริง ไม่ใช่ "ครบแต่ไม่มีรายได้": {excludedMonthsList.map(formatMonthLabel).join(', ')}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h2>แนวโน้มรายได้สุทธิ 4 ปีงบประมาณ</h2>
          <span className="note">รายได้สุทธิ = ขาย − ซื้อ + แบ่งปัน</span>
        </div>
        <div className="trend-card">
          <div className="trend-chart">
            {trend.map((t) => {
              const value = t.totals ? t.totals.netIncome : 0;
              const heightPct = t.totals ? Math.max((Math.abs(value) / maxNetIncome) * 100, 4) : 3;
              return (
                <div className="trend-bar-col" key={t.yearKey}>
                  <div className="trend-bar-val">
                    {t.totals && t.totals.monthsWithData > 0 ? formatBaht(value) : '—'}
                  </div>
                  <div
                    className={
                      t.totals && t.totals.monthsWithData > 0 ? 'trend-bar' : 'trend-bar trend-bar--dim'
                    }
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className="trend-bar-label">{FISCAL_YEAR_DISPLAY_LABEL[t.yearKey]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
