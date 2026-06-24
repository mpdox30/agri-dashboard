// src/pages/communityTabs/BenchmarkTab.jsx
import './BenchmarkTab.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   targetCommunityKey: string
 *   regionName: string
 *   periodLabel: ป้ายข้อความช่วงที่กำลังดู เช่น "ปีงบ 67–68" หรือ "ปี 2026"
 *   completeness: { present, expected } ของชุมชนนี้ในช่วงที่เลือก (สำหรับแบนเนอร์เตือน)
 *   incomeRanking: ผลลัพธ์จาก buildRegionalIncomeRanking()
 *   growthRanking: ผลลัพธ์จาก buildRegionalGrowthRanking() หรือ null ถ้าไม่มีช่วงก่อนหน้า
 *   economicProfile: ผลลัพธ์จาก buildRegionalEconomicProfile()
 */
export default function BenchmarkTab({
  targetCommunityKey,
  regionName,
  periodLabel,
  completeness,
  incomeRanking,
  growthRanking,
  economicProfile,
}) {
  if (!incomeRanking) {
    return (
      <div className="section">
        <div className="empty-note">เลือกชุมชนและช่วงเวลาเพื่อดูการเปรียบเทียบกับชุมชนในภาคเดียวกัน</div>
      </div>
    );
  }

  const isIncomplete = completeness && completeness.present < completeness.expected;

  return (
    <>
      <div className="section">
        <div className="section-head">
          <h2>อันดับเทียบกับชุมชนในภาคเดียวกัน</h2>
          <span className="note">
            {regionName} · {incomeRanking.total} ชุมชน · {periodLabel}
          </span>
        </div>

        {isIncomplete && (
          <div className="incomplete-warning">
            ⚑ ชุมชนนี้มีข้อมูลในช่วงนี้ {completeness.present} จาก {completeness.expected} เดือนที่ควรมี
            — การจัดอันดับด้านล่างใช้ยอดรวมเท่าที่มีข้อมูลจริง เทียบกับชุมชนอื่นที่อาจมีข้อมูลครบกว่า
          </div>
        )}

        <div className="analytics-grid">
          <RankCard
            title={
              <>
                รายได้สุทธิสูงสุดอันดับ <b>{incomeRanking.rank}</b> จาก {incomeRanking.total}{' '}
                ชุมชนในภาค
              </>
            }
            list={incomeRanking.list.map((entry) => ({
              key: entry.communityKey,
              label: `ชุมชน${entry.communityKey}`,
              value: entry.netIncome,
              displayValue: formatBaht(entry.netIncome),
            }))}
            targetKey={targetCommunityKey}
            valueIsPositiveGood
          />

          {growthRanking ? (
            <RankCard
              title={
                growthRanking.rank ? (
                  <>
                    การเติบโตของรายได้อันดับ <b>{growthRanking.rank}</b> จาก {growthRanking.total}{' '}
                    ชุมชนที่เทียบได้ในภาค
                  </>
                ) : (
                  <>ชุมชนนี้ไม่มีข้อมูลช่วงฐานเพียงพอสำหรับคำนวณอัตราเติบโต</>
                )
              }
              list={growthRanking.list.map((entry) => ({
                key: entry.communityKey,
                label: `ชุมชน${entry.communityKey}`,
                value: entry.growthPct,
                displayValue: `${entry.growthPct > 0 ? '+' : ''}${entry.growthPct.toFixed(1)}%`,
              }))}
              targetKey={targetCommunityKey}
              valueIsPositiveGood
              footnote="ชุมชนที่ไม่มีข้อมูลในช่วงฐานหรือช่วงนี้ถูกตัดออกจากการจัดอันดับนี้ (ไม่ถือว่าเติบโต −100%) เพราะอาจหมายถึงหยุดส่งข้อมูล ไม่ใช่รายได้ลดลงจริง"
            />
          ) : (
            <div className="rank-card">
              <div className="empty-note">ไม่มีช่วงก่อนหน้าให้คำนวณอัตราเติบโต</div>
            </div>
          )}
        </div>
      </div>

      {economicProfile && (
        <div className="section">
          <div className="section-head">
            <h2>โปรไฟล์เศรษฐกิจ เทียบค่าเฉลี่ยภาค</h2>
            <span className="note">
              เทียบสัดส่วนแหล่งรายได้ของชุมชนนี้กับค่าเฉลี่ย {economicProfile.regionCommunityCount}{' '}
              ชุมชนใน{economicProfile.regionName}
            </span>
          </div>
          <div className="profile-compare-card">
            <ProfileRow
              label="พึ่งพาการขาย"
              selfPct={economicProfile.self.salePct}
              regionalPct={economicProfile.regional.salePct}
            />
            <ProfileRow
              label="พึ่งพาตนเอง (ลดรายจ่าย)"
              selfPct={economicProfile.self.householdReductionPct}
              regionalPct={economicProfile.regional.householdReductionPct}
            />
            <ProfileRow
              label="แบ่งปันในชุมชน"
              selfPct={economicProfile.self.sharingPct}
              regionalPct={economicProfile.regional.sharingPct}
            />
          </div>
        </div>
      )}
    </>
  );
}

function RankCard({ title, list, targetKey, footnote }) {
  const maxAbsValue = Math.max(1, ...list.map((entry) => Math.abs(entry.value)));
  const targetIndex = list.findIndex((entry) => entry.key === targetKey);
  const topN = list.slice(0, 5);
  const targetInTopN = targetIndex >= 0 && targetIndex < 5;

  return (
    <div className="rank-card">
      <div className="rank-hero">
        <div className="rank-context">{title}</div>
      </div>
      {topN.map((entry, i) => (
        <RankRow
          key={entry.key}
          position={i + 1}
          entry={entry}
          isTarget={entry.key === targetKey}
          maxAbsValue={maxAbsValue}
        />
      ))}
      {!targetInTopN && targetIndex >= 0 && (
        <>
          <div className="rank-ellipsis">⋯</div>
          <RankRow
            position={targetIndex + 1}
            entry={list[targetIndex]}
            isTarget
            maxAbsValue={maxAbsValue}
          />
        </>
      )}
      {footnote && <div className="rank-footnote">{footnote}</div>}
    </div>
  );
}

function RankRow({ position, entry, isTarget, maxAbsValue }) {
  const widthPct = (Math.abs(entry.value) / maxAbsValue) * 100;
  const isNegative = entry.value < 0;
  return (
    <div className={isTarget ? 'rank-list-row highlight' : 'rank-list-row'}>
      <span className="rank-list-pos">{position}</span>
      <span className="rank-list-name">
        {entry.label}
        {isTarget ? ' (ชุมชนนี้)' : ''}
      </span>
      <div className="rank-list-bar-track">
        <div
          className={isTarget ? 'rank-list-bar-fill self' : 'rank-list-bar-fill'}
          style={{ width: `${widthPct}%`, background: isNegative ? 'var(--red-soft)' : undefined }}
        />
      </div>
      <span className="rank-list-val">{entry.displayValue}</span>
    </div>
  );
}

function ProfileRow({ label, selfPct, regionalPct }) {
  return (
    <div className="profile-row">
      <div className="plabel">{label}</div>
      <div className="pbars">
        <div className="profile-bar-track">
          <div className="profile-bar-fill self" style={{ width: `${selfPct}%` }} />
        </div>
        <div className="profile-bar-label">ชุมชนนี้ {selfPct.toFixed(1)}%</div>
        <div className="profile-bar-track">
          <div className="profile-bar-fill regional" style={{ width: `${regionalPct}%` }} />
        </div>
        <div className="profile-bar-label">ค่าเฉลี่ยภาค {regionalPct.toFixed(1)}%</div>
      </div>
    </div>
  );
}
