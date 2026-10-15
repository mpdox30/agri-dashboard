// src/components/KpiRow.jsx
import StatCard from './ui/StatCard';
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
 */
export default function KpiRow({
  currentTotals,
  netDelta = null,
  householdDelta = null,
  deltaSuffix = 'จากช่วงก่อน',
  dataQualityFlagCount,
}) {
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
      />
      <StatCard
        label="ลดรายจ่ายครัวเรือนรวม"
        value={currentTotals.householdReduction}
        format={formatMillionBaht}
        unit="ล้านบาท"
        delta={householdDelta}
        deltaSuffix={deltaSuffix}
        delay={80}
      />
      <StatCard
        label="ชุมชนที่มีข้อมูลในช่วงที่เลือก"
        value={currentTotals.communitiesWithData}
        format={formatInteger}
        unit={`/ ${currentTotals.totalCommunities} ชุมชน`}
        note={missing > 0 ? `${missing} ชุมชนยังไม่มีข้อมูลในช่วงนี้` : 'ทุกชุมชนมีข้อมูลในช่วงนี้'}
        delay={160}
      />
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
