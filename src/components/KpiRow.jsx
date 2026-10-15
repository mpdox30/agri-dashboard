// src/components/KpiRow.jsx
import StatCard from './ui/StatCard';
import Sparkline from './ui/Sparkline';
import './KpiRow.css';

// หน่วยล้านบาท ทศนิยม 2 ตำแหน่ง (คงรูปแบบเดิมของการ์ด KPI) ตัวเลขจะนับขึ้นจาก 0 ตอนเลื่อนมาเห็น
function formatMillionBaht(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   currentTotals: { netIncome, householdReduction, communitiesWithData, totalCommunities }
 *   netDelta / householdDelta: % เปลี่ยนแปลงเทียบช่วงก่อน หรือ null ถ้าเทียบไม่ได้ (คำนวณแบบจับคู่เดือน
 *     เดียวกันมาจากข้างนอก ดู buildYearOverYearComparison ใน homepageAggregations.js)
 *   deltaSuffix: ข้อความต่อท้ายป้ายเปลี่ยนแปลง
 *   dataQualityFlagCount: number
 *   netSeries / householdSeries: ค่ารายเดือนของช่วงที่เลือก (null = เดือนที่ยังไม่มีข้อมูล) ไว้วาดเส้นแนวโน้มเล็กใต้ตัวเลข
 */
export default function KpiRow({
  currentTotals,
  netDelta = null,
  householdDelta = null,
  deltaSuffix = 'จากช่วงก่อน',
  dataQualityFlagCount,
  netSeries = null,
  householdSeries = null,
}) {
  const hasSpark = (s) => Array.isArray(s) && s.filter((v) => v !== null).length >= 3;
  const coveragePct =
    currentTotals.totalCommunities > 0 ? (currentTotals.communitiesWithData / currentTotals.totalCommunities) * 100 : 0;
  const missing = currentTotals.totalCommunities - currentTotals.communitiesWithData;
  const cleanPercent =
    currentTotals.communitiesWithData > 0
      ? ((currentTotals.communitiesWithData - dataQualityFlagCount) / currentTotals.communitiesWithData) * 100
      : null;

  return (
    <div className="kpi-row">
      <StatCard
        label="รายได้สุทธิรวม"
        value={currentTotals.netIncome}
        format={formatMillionBaht}
        unit="ล้านบาท"
        delta={netDelta}
        deltaSuffix={deltaSuffix}
        delay={0}
      >
        {hasSpark(netSeries) && (
          <Sparkline className="kpi-row__spark" values={netSeries} width={220} height={34} color="var(--green-soft)" label="แนวโน้มรายได้สุทธิรายเดือนของช่วงที่เลือก" />
        )}
      </StatCard>
      <StatCard
        label="ลดรายจ่ายครัวเรือนรวม"
        value={currentTotals.householdReduction}
        format={formatMillionBaht}
        unit="ล้านบาท"
        delta={householdDelta}
        deltaSuffix={deltaSuffix}
        delay={80}
      >
        {hasSpark(householdSeries) && (
          <Sparkline className="kpi-row__spark" values={householdSeries} width={220} height={34} color="var(--terracotta)" label="แนวโน้มการลดรายจ่ายครัวเรือนรายเดือนของช่วงที่เลือก" />
        )}
      </StatCard>
      <StatCard
        label="ชุมชนที่มีข้อมูลในช่วงที่เลือก"
        value={currentTotals.communitiesWithData}
        format={formatInteger}
        unit={`/ ${currentTotals.totalCommunities} ชุมชน`}
        note={missing > 0 ? `${missing} ชุมชนยังไม่มีข้อมูลในช่วงนี้` : 'ทุกชุมชนมีข้อมูลในช่วงนี้'}
        delay={160}
      >
        <div className="kpi-row__meter" role="img" aria-label={`ครอบคลุม ${coveragePct.toFixed(0)}% ของชุมชนทั้งหมด`}>
          <span style={{ width: `${coveragePct}%` }} />
        </div>
      </StatCard>
      <StatCard
        label={
          <>
            คุณภาพข้อมูล
            {dataQualityFlagCount > 0 && (
              <span className="data-flag" title={`มี ${dataQualityFlagCount} ชุมชนที่มีประเด็นตรวจสอบในช่วงนี้`}>
                ⚑ {dataQualityFlagCount}
              </span>
            )}
          </>
        }
        value={cleanPercent}
        format={formatInteger}
        unit="% ไม่มีประเด็นต้องตรวจสอบ"
        delay={240}
      />
    </div>
  );
}
