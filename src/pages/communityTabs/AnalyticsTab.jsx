// src/pages/communityTabs/AnalyticsTab.jsx
import SeasonalLineChart from '../../components/SeasonalLineChart';
import './AnalyticsTab.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   periodLabel: ป้ายข้อความช่วงที่กำลังดู เช่น "ปีงบ 67–68" หรือ "ปี 2026"
 *   previousPeriodLabel: ป้ายข้อความช่วงก่อนหน้า (สำหรับคำอธิบาย retention) หรือ null
 *   completeness: { present, expected } จำนวนเดือนที่มีข้อมูลจริง เทียบที่ควรมี
 *   seasonal: ผลลัพธ์จาก buildSeasonalBreakdown() — คำนวณจากข้อมูลเท่าที่มี แม้ไม่ครบปี
 *   composition: ผลลัพธ์จาก buildIncomeComposition()
 *   memberStats: ผลลัพธ์จาก buildMemberIncomeStats()
 *   retention: ผลลัพธ์จาก buildMemberRetention() หรือ null ถ้าไม่มีช่วงก่อนหน้าให้เทียบ
 */
export default function AnalyticsTab({
  periodLabel,
  previousPeriodLabel,
  completeness,
  seasonal,
  composition,
  memberStats,
  retention,
}) {
  if (!completeness || completeness.present === 0) {
    return (
      <div className="section">
        <div className="empty-note">
          ไม่มีข้อมูลในช่วงเวลานี้ — เลือกช่วงอื่นที่มีข้อมูลกรอกแล้ว เพื่อดูการวิเคราะห์เชิงลึก
        </div>
      </div>
    );
  }

  const isIncomplete = completeness.present < completeness.expected;

  return (
    <div className="section">
      <div className="section-head">
        <h2>วิเคราะห์เชิงลึก — {periodLabel}</h2>
        <span className="note">คำนวณจากข้อมูลของช่วงที่เลือกไว้ด้านบน</span>
      </div>

      {isIncomplete && (
        <div className="incomplete-warning">
          ⚑ ช่วงนี้มีข้อมูล {completeness.present} จาก {completeness.expected} เดือนที่ควรมี —
          ผลการวิเคราะห์ด้านล่างคำนวณจากเดือนที่มีข้อมูลจริงเท่านั้น อาจไม่สะท้อนทั้งช่วงสมบูรณ์
        </div>
      )}

      <div className="season-card season-card--featured">
        <div className="card-title card-title--featured">รายได้สุทธิ: ฤดูฝน เทียบ ฤดูแล้ง</div>
        <div className="season-compare">
          <div className="season-block rainy">
            <div className="s-label">🌧 ฤดูฝน (พ.ค.–ต.ค.)</div>
            <div className="s-value s-value--featured">{formatBaht(seasonal.rainyTotal)} ฿</div>
            <div className="s-months">{seasonal.rainyPct.toFixed(1)}% ของรายได้ในช่วงนี้</div>
            <div className="season-bar-track">
              <div className="season-bar-fill rainy" style={{ width: `${seasonal.rainyPct}%` }} />
            </div>
          </div>
          <div className="season-block dry">
            <div className="s-label">☀️ ฤดูแล้ง (พ.ย.–เม.ย.)</div>
            <div className="s-value s-value--featured">{formatBaht(seasonal.dryTotal)} ฿</div>
            <div className="s-months">{seasonal.dryPct.toFixed(1)}% ของรายได้ในช่วงนี้</div>
            <div className="season-bar-track">
              <div className="season-bar-fill dry" style={{ width: `${seasonal.dryPct}%` }} />
            </div>
          </div>
        </div>
        <SeasonalLineChart monthly={seasonal.monthly} tall />
      </div>

      <div className="analytics-grid">
        <div className="composition-card composition-card--full">
          <div className="card-title">องค์ประกอบรายได้สุทธิ — {periodLabel}</div>
          <div className="comp-stack">
            <div style={{ width: `${composition.salePct}%`, background: 'var(--green-soft)' }} />
            <div style={{ width: `${composition.sharingPct}%`, background: 'var(--gold)' }} />
          </div>
          <div className="comp-legend">
            <CompLegendRow color="var(--green-soft)" label="ขาย" value={composition.sale} />
            <CompLegendRow color="var(--gold)" label="แบ่งปันในชุมชน" value={composition.sharing} />
          </div>
          <div className="comp-deduction-row">
            <span>− ซื้อ (หักออก)</span>
            <span>{formatBaht(composition.purchase)} ฿</span>
          </div>
          <div className="comp-formula-footer">
            รายได้สุทธิ = ขาย + แบ่งปัน − ซื้อ = <b>{formatBaht(composition.netIncome)} ฿</b>
          </div>
          <div className="comp-separate-note">
            ลดรายจ่ายครัวเรือน ({formatBaht(composition.householdReduction)} ฿) ไม่ได้นับรวมในรายได้สุทธิ
            — เป็นตัวชี้วัดแยก ดูได้ที่การ์ด KPI ด้านบน
          </div>
        </div>
      </div>

      <div className="analytics-grid analytics-grid--bottom">
        <div className="stat-row-card">
          <div className="card-title">ความเหลื่อมล้ำรายได้ระหว่างสมาชิก</div>
          <div className="stat-line">
            <span className="slabel">รายได้เฉลี่ยต่อคน</span>
            <span className="sval">{formatBaht(memberStats.mean)} ฿</span>
          </div>
          <div className="stat-line">
            <span className="slabel">รายได้มัธยฐาน (คนกลาง)</span>
            <span className="sval">{formatBaht(memberStats.median)} ฿</span>
          </div>
          <div className="stat-line">
            <span className="slabel">สูงสุด / ต่ำสุด</span>
            <span className="sval">
              {formatBaht(memberStats.max)} ฿ / {formatBaht(memberStats.min)} ฿
            </span>
          </div>
          <div className="inequality-bar-track">
            <div
              className="inequality-bar-fill"
              style={{ width: `${Math.min(memberStats.top10PctShare, 100)}%` }}
            />
          </div>
          <div className="inequality-caption">
            สมาชิก {memberStats.topCount} อันดับแรก (~10%) ถือรายได้รวม{' '}
            <b>{memberStats.top10PctShare.toFixed(1)}%</b> ของทั้งชุมชน
          </div>
        </div>

        <div className="retention-card">
          {retention ? (
            <>
              <div className="retention-ring">
                <div className="retention-ring-inner">{retention.retentionPct.toFixed(0)}%</div>
              </div>
              <div className="retention-detail">
                <b>สมาชิกคงอยู่ต่อเนื่อง</b> จาก{' '}
                {previousPeriodLabel || ''} สู่ {periodLabel}
                <br />
                {retention.retainedCount}/{retention.previousCount} คนยังกรอกข้อมูลต่อเนื่อง
              </div>
            </>
          ) : (
            <div className="retention-detail">ไม่มีช่วงก่อนหน้าให้เทียบอัตราคงอยู่ของสมาชิก</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompLegendRow({ color, label, value }) {
  return (
    <div className="comp-legend-row">
      <span className="comp-legend-left">
        <span className="comp-dot" style={{ background: color }} />
        {label}
      </span>
      <span className="comp-val">{formatBaht(value)} ฿</span>
    </div>
  );
}
