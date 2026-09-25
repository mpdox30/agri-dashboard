// src/pages/communityTabs/AnalyticsTab.jsx
import { useEffect, useState } from 'react';
import SeasonalLineChart from '../../components/SeasonalLineChart';
import YearOverYearChart, { YOY_SERIES_COLORS } from '../../components/YearOverYearChart';
import DependencyTrendChart from '../../components/DependencyTrendChart';
import './AnalyticsTab.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function formatSigned(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${formatBaht(n)} ฿`;
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
 *
 *   --- ส่วนขยาย (ไอเดียข้อ 1-7) ---
 *   targetCommunityKey: community_key ของชุมชนที่กำลังดู (สำหรับไฮไลต์ในการ์ดจัดอันดับ)
 *   yoyComparison: ผลลัพธ์จาก buildMultiYearComparison() หรือ null (หลายปีย้อนหลังซ้อนกัน ไม่ใช่แค่ปีก่อนหน้าปีเดียว)
 *   yoyGrowthPct: % เติบโตของปีที่เลือกอยู่ เทียบปีย้อนหลังปีล่าสุดปีเดียว (จาก series[0] vs series[1]) หรือ null
 *   lorenzCurve: ผลลัพธ์จาก buildLorenzCurve() หรือ null
 *   memberVolatility: ผลลัพธ์จาก buildMemberVolatility() หรือ null
 *   dependencyTrend: ผลลัพธ์จาก buildDependencyTrend() หรือ null
 *   provincePeerRanking: ผลลัพธ์จาก buildProvincePeerRanking() หรือ null
 *   forecast: ผลลัพธ์จาก buildSimpleForecast() หรือ null (คำนวณจากประวัติทั้งหมด ไม่ผูกช่วงที่เลือก)
 *   growthDrivers: ผลลัพธ์จาก buildGrowthDrivers() หรือ null
 */
export default function AnalyticsTab({
  periodLabel,
  previousPeriodLabel,
  completeness,
  seasonal,
  composition,
  memberStats,
  retention,
  targetCommunityKey,
  yoyComparison,
  yoyGrowthPct,
  lorenzCurve,
  memberVolatility,
  dependencyTrend,
  provincePeerRanking,
  forecast,
  growthDrivers,
}) {
  // ปีที่เลือกให้ซ้อนแสดงในกราฟ "เทียบรายได้ข้ามปี" (ไม่รวมปีปัจจุบันที่แสดงเสมอ) — เก็บ
  // เป็น local state เพราะเป็นแค่ตัวกรองการแสดงผลของกราฟเดียว ไม่กระทบการคำนวณอื่นใด
  // (yoyComparison มีข้อมูลของทุกปีในประวัติมาให้พร้อมอยู่แล้วจาก CommunityView)
  const availableYoyKeysSignature = yoyComparison ? yoyComparison.series.map((s) => s.key).join('|') : '';
  const [selectedYoyKeys, setSelectedYoyKeys] = useState(() => new Set());

  useEffect(() => {
    // เลือกทุกปีที่มีเป็นค่าเริ่มต้นเสมอ รีเซ็ตทุกครั้งที่ชุดปีที่มีให้เทียบเปลี่ยนไป (เช่น
    // สลับชุมชนหรือช่วงที่ดูอยู่ด้านบน) กันไม่ให้ selection เก่าค้างจนดูเหมือนกราฟหายไปเฉย ๆ
    if (!yoyComparison) return;
    setSelectedYoyKeys(new Set(yoyComparison.series.map((s) => s.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYoyKeysSignature]);

  function toggleYoyYear(key) {
    setSelectedYoyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
  const visibleYoySeries = yoyComparison
    ? yoyComparison.series.filter((s) => s.isCurrent || selectedYoyKeys.has(s.key))
    : [];

  return (
    <>
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

        {/* ไฮไลต์หลักของหน้านี้ — ขยายให้ใหญ่และเด่นกว่าการ์ดอื่นทั้งหมด เต็มความกว้าง */}
        <div className="analytics-highlight">
          <div className="season-card season-card--highlight">
            <div className="card-title card-title--highlight">รายได้สุทธิ: ฤดูฝน เทียบ ฤดูแล้ง</div>
            <div className="season-compare">
              <div className="season-block rainy">
                <div className="s-label">🌧 ฤดูฝน (พ.ค.–ต.ค.)</div>
                <div className="s-value">{formatBaht(seasonal.rainyTotal)} ฿</div>
                <div className="s-months">{seasonal.rainyPct.toFixed(1)}% ของรายได้ในช่วงนี้</div>
                <div className="season-bar-track">
                  <div className="season-bar-fill rainy" style={{ width: `${seasonal.rainyPct}%` }} />
                </div>
              </div>
              <div className="season-block dry">
                <div className="s-label">☀️ ฤดูแล้ง (พ.ย.–เม.ย.)</div>
                <div className="s-value">{formatBaht(seasonal.dryTotal)} ฿</div>
                <div className="s-months">{seasonal.dryPct.toFixed(1)}% ของรายได้ในช่วงนี้</div>
                <div className="season-bar-track">
                  <div className="season-bar-fill dry" style={{ width: `${seasonal.dryPct}%` }} />
                </div>
              </div>
            </div>
            <SeasonalLineChart monthly={seasonal.monthly} />
          </div>
        </div>

        {/* การ์ดรอง — ดันลงมาไว้ข้างล่างไฮไลต์หลัก */}
        <div className="analytics-grid analytics-grid--secondary">
          <div className="composition-card">
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

      {/* เทียบรายได้ข้ามปี — เดือนต่อเดือน ซ้อนหลายปีย้อนหลัง */}
      {yoyComparison && (
        <div className="section">
          <div className="section-head">
            <h2>เทียบรายได้ข้ามปี — เดือนต่อเดือน</h2>
            <span className="note">
              แสดง {visibleYoySeries.length} จาก {yoyComparison.series.length} ปีที่มีในประวัติ ·{' '}
              {yoyGrowthPct !== null ? (
                <>
                  {periodLabel} เทียบ {yoyComparison.series[1]?.label} รวมทั้งช่วง{' '}
                  <b className={yoyGrowthPct >= 0 ? 'trend-up' : 'trend-down'}>
                    {yoyGrowthPct > 0 ? '+' : ''}
                    {yoyGrowthPct.toFixed(1)}%
                  </b>
                </>
              ) : (
                'ไม่มีปีย้อนหลังให้เทียบ % การเติบโต'
              )}
            </span>
          </div>
          <div className="chart-section-card">
            <div className="yoy-year-toggles">
              <span className="yoy-year-toggle yoy-year-toggle--current">
                <span className="yoy-year-toggle-dot" style={{ background: YOY_SERIES_COLORS[0] }} />
                {yoyComparison.series[0].label} (ปีที่ดูอยู่ — แสดงเสมอ)
              </span>
              {yoyComparison.series.slice(1).map((s) => {
                const active = selectedYoyKeys.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={active ? 'yoy-year-toggle active' : 'yoy-year-toggle'}
                    onClick={() => toggleYoyYear(s.key)}
                    aria-pressed={active}
                  >
                    <span
                      className="yoy-year-toggle-dot"
                      style={{ background: YOY_SERIES_COLORS[s.colorIndex % YOY_SERIES_COLORS.length] }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <YearOverYearChart monthLabels={yoyComparison.monthLabels} series={visibleYoySeries} />
          </div>
        </div>
      )}

      {/* แนวโน้มการพึ่งพาแหล่งรายได้ */}
      {dependencyTrend && (
        <div className="section">
          <div className="section-head">
            <h2>แนวโน้มการพึ่งพาแหล่งรายได้</h2>
            <span className="note">สัดส่วนแต่ละเดือนใน {periodLabel} — ขาย / แบ่งปัน / ผลิตเอง / รับฟรี-อื่นๆ</span>
          </div>
          <div className="chart-section-card">
            <DependencyTrendChart monthly={dependencyTrend.monthly} />
            <div className="dep-avg-footer">
              เฉลี่ยทั้งช่วง: ขาย {dependencyTrend.avgSalePct.toFixed(1)}% · แบ่งปัน{' '}
              {dependencyTrend.avgSharingPct.toFixed(1)}% · ผลิตเอง {dependencyTrend.avgSelfProducedPct.toFixed(1)}%
              · รับฟรี/อื่นๆ {dependencyTrend.avgFreeOtherPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Lorenz curve / ความผันผวน / อันดับในจังหวัด */}
      <div className="section">
        <div className="section-head">
          <h2>มิติเพิ่มเติม — ความเหลื่อมล้ำ ความผันผวน และอันดับในจังหวัด</h2>
          <span className="note">{periodLabel}</span>
        </div>
        <div className="analytics-grid analytics-grid--secondary">
          {lorenzCurve && <LorenzCurveCard lorenzCurve={lorenzCurve} />}
          {memberVolatility && <VolatilityCard memberVolatility={memberVolatility} />}
          <PeerRankCard provincePeerRanking={provincePeerRanking} targetCommunityKey={targetCommunityKey} />
        </div>
      </div>

      {/* ปัจจัยการเติบโต / พยากรณ์แนวโน้ม */}
      {(growthDrivers || forecast) && (
        <div className="section">
          <div className="section-head">
            <h2>ปัจจัยการเติบโต และแนวโน้มเดือนถัดไป</h2>
            <span className="note">
              ปัจจัยเติบโต: {periodLabel} เทียบ {previousPeriodLabel || '—'} · พยากรณ์: จากประวัติทั้งหมด
            </span>
          </div>
          <div className="analytics-grid analytics-grid--drivers">
            <GrowthDriversCard growthDrivers={growthDrivers} previousPeriodLabel={previousPeriodLabel} />
            <ForecastCard forecast={forecast} />
          </div>
        </div>
      )}
    </>
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

/** การ์ด Lorenz curve + ค่าสัมประสิทธิ์ Gini — SVG เล็ก ๆ วาดเส้นโค้งเทียบเส้นเสมอภาค */
function LorenzCurveCard({ lorenzCurve }) {
  const SIZE = 160;
  const path = lorenzCurve.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x / 100) * SIZE} ${SIZE - (p.y / 100) * SIZE}`).join(' ');
  const areaPath = `${path} L ${SIZE} ${SIZE} L 0 ${SIZE} Z`;

  return (
    <div className="stat-row-card lorenz-card">
      <div className="card-title">
        ความเหลื่อมล้ำรายได้ (Lorenz curve) — Gini = <b>{lorenzCurve.gini.toFixed(3)}</b>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="lorenz-svg" role="img" aria-label="Lorenz curve ของรายได้สมาชิก">
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} className="lorenz-equality-line" />
        <path d={areaPath} className="lorenz-area" />
        <path d={path} className="lorenz-curve-path" fill="none" />
      </svg>
      <div className="lorenz-caption">
        แกนนอน = สัดส่วนสะสมของสมาชิก (น้อย→มาก) · แกนตั้ง = สัดส่วนสะสมของรายได้ · ยิ่งเส้นโค้งห่างจากเส้นทแยงมุม
        ยิ่งเหลื่อมล้ำมาก (0 = เท่ากันหมด, ใกล้ 1 = กระจุกตัวสูง)
      </div>
    </div>
  );
}

/** การ์ดความผันผวนของรายได้ต่อสมาชิก (coefficient of variation) */
function VolatilityCard({ memberVolatility }) {
  if (memberVolatility.members.length === 0) {
    return (
      <div className="stat-row-card">
        <div className="card-title">ความผันผวนของรายได้ต่อสมาชิก</div>
        <div className="empty-note">สมาชิกในช่วงนี้มีข้อมูลไม่พอ (ต้องมีอย่างน้อย 2 เดือน และรายได้เฉลี่ยเป็นบวก) สำหรับวัดความผันผวน</div>
      </div>
    );
  }

  return (
    <div className="stat-row-card">
      <div className="card-title">ความผันผวนของรายได้ต่อสมาชิก (CV)</div>
      <div className="stat-line">
        <span className="slabel">ค่าเฉลี่ยความผันผวนทั้งชุมชน</span>
        <span className="sval">{memberVolatility.avgCv.toFixed(1)}%</span>
      </div>
      <div className="volatility-subhead">แกว่งมากที่สุด</div>
      {memberVolatility.mostVolatile.map((m) => (
        <div className="stat-line" key={`v-${m.fullName}`}>
          <span className="slabel">{m.fullName}</span>
          <span className="sval">{m.cv.toFixed(1)}%</span>
        </div>
      ))}
      <div className="volatility-subhead">คงที่ที่สุด</div>
      {memberVolatility.mostStable.map((m) => (
        <div className="stat-line" key={`s-${m.fullName}`}>
          <span className="slabel">{m.fullName}</span>
          <span className="sval">{m.cv.toFixed(1)}%</span>
        </div>
      ))}
      <div className="inequality-caption">CV = ส่วนเบี่ยงเบนมาตรฐาน ÷ ค่าเฉลี่ย — ยิ่งสูงยิ่งรายได้แกว่งมากในแต่ละเดือน</div>
    </div>
  );
}

/** การ์ดอันดับรายได้เทียบชุมชนอื่นในจังหวัดเดียวกัน (เจาะจงกว่าแท็บเปรียบเทียบที่เป็นระดับภาค) */
function PeerRankCard({ provincePeerRanking, targetCommunityKey }) {
  if (!provincePeerRanking) {
    return (
      <div className="stat-row-card">
        <div className="card-title">อันดับในจังหวัดเดียวกัน</div>
        <div className="empty-note">ไม่มีชุมชนอื่นในจังหวัดเดียวกันให้เทียบ หรือไม่ทราบข้อมูลจังหวัดของชุมชนนี้</div>
      </div>
    );
  }

  const list = provincePeerRanking.list;
  const maxAbsValue = Math.max(1, ...list.map((entry) => Math.abs(entry.netIncome)));
  const targetIndex = list.findIndex((entry) => entry.communityKey === targetCommunityKey);
  const topN = list.slice(0, 5);
  const targetInTopN = targetIndex >= 0 && targetIndex < 5;

  return (
    <div className="stat-row-card peer-rank-card">
      <div className="card-title">
        อันดับรายได้สุทธิในจังหวัด{provincePeerRanking.provinceName} — อันดับ{' '}
        <b>{provincePeerRanking.rank}</b> จาก {provincePeerRanking.total} ชุมชน
      </div>
      {topN.map((entry, i) => (
        <PeerRankRow
          key={entry.communityKey}
          position={i + 1}
          entry={entry}
          isTarget={entry.communityKey === targetCommunityKey}
          maxAbsValue={maxAbsValue}
        />
      ))}
      {!targetInTopN && targetIndex >= 0 && (
        <>
          <div className="rank-ellipsis">⋯</div>
          <PeerRankRow position={targetIndex + 1} entry={list[targetIndex]} isTarget maxAbsValue={maxAbsValue} />
        </>
      )}
    </div>
  );
}

function PeerRankRow({ position, entry, isTarget, maxAbsValue }) {
  const widthPct = (Math.abs(entry.netIncome) / maxAbsValue) * 100;
  const isNegative = entry.netIncome < 0;
  return (
    <div className={isTarget ? 'rank-list-row highlight' : 'rank-list-row'}>
      <span className="rank-list-pos">{position}</span>
      <span className="rank-list-name">
        ชุมชน{entry.communityKey}
        {isTarget ? ' (ชุมชนนี้)' : ''}
      </span>
      <div className="rank-list-bar-track">
        <div
          className={isTarget ? 'rank-list-bar-fill self' : 'rank-list-bar-fill'}
          style={{ width: `${widthPct}%`, background: isNegative ? 'var(--red-soft)' : undefined }}
        />
      </div>
      <span className="rank-list-val">{formatBaht(entry.netIncome)} ฿</span>
    </div>
  );
}

/** การ์ดแยกสาเหตุการเติบโต: ผลจากจำนวนสมาชิก vs ผลจากรายได้ต่อคน */
function GrowthDriversCard({ growthDrivers, previousPeriodLabel }) {
  if (!growthDrivers) {
    return (
      <div className="stat-row-card">
        <div className="card-title">ปัจจัยการเติบโตของรายได้รวม</div>
        <div className="empty-note">ไม่มีช่วงก่อนหน้าให้เทียบ หรือช่วงใดช่วงหนึ่งไม่มีข้อมูลเพียงพอ</div>
      </div>
    );
  }

  const maxAbs = Math.max(
    1,
    Math.abs(growthDrivers.memberCountEffect),
    Math.abs(growthDrivers.perMemberIncomeEffect),
    Math.abs(growthDrivers.totalDelta)
  );

  return (
    <div className="stat-row-card">
      <div className="card-title">ปัจจัยการเติบโตของรายได้รวม เทียบ {previousPeriodLabel || 'ช่วงก่อนหน้า'}</div>
      <div className="stat-line">
        <span className="slabel">สมาชิก: {growthDrivers.previousMembers} → {growthDrivers.currentMembers} คน</span>
        <span className="sval">{formatBaht(growthDrivers.currentPerMember)} ฿/คน</span>
      </div>
      <DriverBar label="ผลจากจำนวนสมาชิกเปลี่ยน" value={growthDrivers.memberCountEffect} maxAbs={maxAbs} />
      <DriverBar label="ผลจากรายได้ต่อคนเปลี่ยน" value={growthDrivers.perMemberIncomeEffect} maxAbs={maxAbs} />
      <div className="comp-formula-footer">
        รวมการเปลี่ยนแปลง = <b className={growthDrivers.totalDelta >= 0 ? 'trend-up' : 'trend-down'}>{formatSigned(growthDrivers.totalDelta)}</b>
      </div>
    </div>
  );
}

function DriverBar({ label, value, maxAbs }) {
  const widthPct = (Math.abs(value) / maxAbs) * 100;
  const isNegative = value < 0;
  return (
    <div className="driver-bar-row">
      <div className="driver-bar-label">
        <span>{label}</span>
        <span className={isNegative ? 'trend-down' : 'trend-up'}>{formatSigned(value)}</span>
      </div>
      <div className="driver-bar-track">
        <div
          className="driver-bar-fill"
          style={{ width: `${widthPct}%`, background: isNegative ? 'var(--red-soft)' : 'var(--green-soft)' }}
        />
      </div>
    </div>
  );
}

/** การ์ดพยากรณ์แนวโน้มอย่างง่าย (moving average + linear trend) */
function ForecastCard({ forecast }) {
  if (!forecast) {
    return (
      <div className="stat-row-card">
        <div className="card-title">พยากรณ์แนวโน้มเดือนถัดไป</div>
        <div className="empty-note">มีข้อมูลย้อนหลังไม่พอสำหรับพยากรณ์ (ต้องมีอย่างน้อย 3 เดือน)</div>
      </div>
    );
  }

  const trendIcon = forecast.trendDirection === 'up' ? '↗' : forecast.trendDirection === 'down' ? '↘' : '→';
  const trendClass =
    forecast.trendDirection === 'up' ? 'trend-up' : forecast.trendDirection === 'down' ? 'trend-down' : '';
  const trendText =
    forecast.trendDirection === 'up' ? 'มีแนวโน้มเพิ่มขึ้น' : forecast.trendDirection === 'down' ? 'มีแนวโน้มลดลง' : 'ค่อนข้างคงที่';

  return (
    <div className="stat-row-card">
      <div className="card-title">
        พยากรณ์แนวโน้มเดือนถัดไป ({forecast.nextMonthLabel}) <span className={trendClass}>{trendIcon}</span>
      </div>
      <div className="stat-line">
        <span className="slabel">ค่าเฉลี่ยเคลื่อนที่ {forecast.windowMonths} เดือนล่าสุด</span>
        <span className="sval">{formatBaht(forecast.movingAverage)} ฿</span>
      </div>
      <div className="stat-line">
        <span className="slabel">ประมาณจากเส้นแนวโน้ม</span>
        <span className="sval">{formatBaht(forecast.linearForecast)} ฿</span>
      </div>
      <div className={`inequality-caption ${trendClass}`}>{trendText}</div>
      <div className="comp-separate-note">
        เป็นการประมาณคร่าว ๆ จากแนวโน้มในอดีตเท่านั้น ไม่ควรใช้ตัดสินใจเชิงนโยบายโดยลำพัง
      </div>
    </div>
  );
}
