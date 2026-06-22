// src/pages/DataQuality.jsx
import { useEffect, useMemo, useState } from 'react';
import { getMonthlySummary, getMonthlyRecords } from '../api/appsScript';
import {
  findNearDuplicateNames,
  findCarryoverDuplicates,
  findUnenteredMonthRunsAcrossSystem,
} from './dataQualityChecks';
import { formatMonthLabel } from './fiscalYears';
import './DataQuality.css';

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DataQuality() {
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [allSummaryRows, setAllSummaryRows] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [showFutureRuns, setShowFutureRuns] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState('loading');
      try {
        const [summaryData, recordsData] = await Promise.all([
          getMonthlySummary(), // ทุกชุมชน
          getMonthlyRecords(), // ทุกชุมชน — ไฟล์ใหญ่ (~59,000 แถว) อาจใช้เวลาสักครู่
        ]);
        if (cancelled) return;
        setAllSummaryRows(summaryData);
        setAllRecords(recordsData);
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

  const nearDuplicates = useMemo(
    () => (loadState === 'ready' ? findNearDuplicateNames(allRecords) : []),
    [allRecords, loadState]
  );
  const carryoverDuplicates = useMemo(
    () => (loadState === 'ready' ? findCarryoverDuplicates(allRecords) : []),
    [allRecords, loadState]
  );
  const unenteredRuns = useMemo(
    () => (loadState === 'ready' ? findUnenteredMonthRunsAcrossSystem(allSummaryRows, currentMonthString()) : []),
    [allSummaryRows, loadState]
  );

  const visibleRuns = showFutureRuns ? unenteredRuns : unenteredRuns.filter((r) => r.category.includes('ตรวจสอบ'));
  const pastRunsCount = unenteredRuns.filter((r) => r.category.includes('ตรวจสอบ')).length;
  const futureRunsCount = unenteredRuns.length - pastRunsCount;

  if (loadState === 'loading') {
    return (
      <div className="dq-status">
        <p>กำลังโหลดและตรวจสอบข้อมูลทั้งระบบ...</p>
        <p className="dq-status__hint">ต้องดึงข้อมูลรายเดือนของทุกชุมชน (~59,000 แถว) อาจใช้เวลาสักครู่</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="dq-status dq-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="data-quality">
      <div className="dq-hero">
        <h1>คุณภาพข้อมูล</h1>
        <p className="dq-sub">
          ตรวจสอบปัญหาที่พบได้บ่อยในข้อมูลที่กรอกมาหลายปีโดยหลายคน — ระบบสแกนทุกครั้งที่เปิด
          หน้านี้ ไม่ต้องรอให้ส่งไฟล์ CSV มาให้ทีหลังอีก
        </p>
      </div>

      <div className="dq-section">
        <div className="dq-section-head">
          <h2>ชื่อสมาชิกที่อาจซ้ำกัน</h2>
          <span className="dq-count">{nearDuplicates.length} คู่</span>
        </div>
        <p className="dq-explain">
          ชื่อที่สะกดต่างกันเล็กน้อยในชุมชนเดียวกัน (เว้นวรรค วงเล็บ ตัวสะกด) อาจเป็นคนเดียวกัน
          ที่ถูกกรอกไม่ตรงกันในต่างเดือน/ต่างปี — ถ้าใช่ ควรรวมเป็นชื่อเดียวที่ต้นทาง (Sheets)
          ไม่ใช่แค่ในหน้านี้ เพราะถ้าปล่อยไว้จะกรอกซ้ำเป็นคนละคนในหน้ากรอกข้อมูลต่อไป
        </p>
        {nearDuplicates.length === 0 ? (
          <div className="dq-empty">ไม่พบชื่อที่คล้ายกันผิดสังเกต</div>
        ) : (
          <div className="dq-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ชุมชน</th>
                  <th>ชื่อ A</th>
                  <th>ชื่อ B</th>
                  <th className="num">ความคล้าย</th>
                  <th>ความมั่นใจ</th>
                </tr>
              </thead>
              <tbody>
                {nearDuplicates.map((d, i) => (
                  <tr key={i}>
                    <td>ชุมชน{d.communityKey}</td>
                    <td>{d.nameA}</td>
                    <td>{d.nameB}</td>
                    <td className="num">{(d.similarity * 100).toFixed(1)}%</td>
                    <td>
                      <span
                        className={
                          d.confidence.includes('สูงมาก')
                            ? 'dq-tag dq-tag--high'
                            : d.confidence.includes('สูง')
                            ? 'dq-tag dq-tag--medium'
                            : 'dq-tag dq-tag--low'
                        }
                      >
                        {d.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dq-section">
        <div className="dq-section-head">
          <h2>ข้อมูลที่อาจคัดลอกข้ามปี</h2>
          <span className="dq-count">{carryoverDuplicates.length} ช่วง</span>
        </div>
        <p className="dq-explain">
          เดือนที่ตัวเลขของสมาชิกหลายคนตรงกับเดือนเดียวกันของปีก่อนหน้าเป๊ะทุกช่อง — มักเกิดจาก
          การคัดลอกไฟล์ปีก่อนมาเป็นต้นแบบสำหรับปีใหม่ แล้วลืมแก้บางเดือนก่อนส่ง
        </p>
        {carryoverDuplicates.length === 0 ? (
          <div className="dq-empty">ไม่พบรูปแบบนี้</div>
        ) : (
          <div className="dq-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ชุมชน</th>
                  <th>เดือน</th>
                  <th>เทียบกับ</th>
                  <th className="num">ซ้ำ/ทั้งหมด</th>
                  <th className="num">%</th>
                  <th>ตัวอย่าง</th>
                </tr>
              </thead>
              <tbody>
                {carryoverDuplicates.map((c, i) => (
                  <tr key={i}>
                    <td>ชุมชน{c.communityKey}</td>
                    <td>{c.month}</td>
                    <td>{c.comparedToMonth}</td>
                    <td className="num">
                      {c.duplicatedMembers}/{c.totalMembers}
                    </td>
                    <td className="num">{c.duplicatedPct}%</td>
                    <td>{c.exampleMember}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dq-section">
        <div className="dq-section-head">
          <h2>ช่วงที่อาจไม่ได้กรอกข้อมูลจริง</h2>
          <span className="dq-count">{pastRunsCount} ช่วงในอดีต</span>
        </div>
        <p className="dq-explain">
          ค่าทุกยอด (ขาย ซื้อ แบ่งปัน ลดรายจ่าย) เป็น 0 ต่อเนื่องตั้งแต่ 4 เดือนขึ้นไป — หน้า
          "ข้อมูลเชิงวิเคราะห์" จะตัดเดือนเหล่านี้ออกจากการนับว่า "มีข้อมูล" ให้อัตโนมัติแล้ว
          ส่วน {futureRunsCount} ช่วงที่เป็นเดือนอนาคต ไม่ต้องตรวจสอบ (ยังไม่เกิดขึ้นจริง)
        </p>
        <label className="dq-toggle-future">
          <input
            type="checkbox"
            checked={showFutureRuns}
            onChange={(e) => setShowFutureRuns(e.target.checked)}
          />
          แสดงช่วงเดือนอนาคตด้วย ({futureRunsCount} ช่วง)
        </label>
        {visibleRuns.length === 0 ? (
          <div className="dq-empty">ไม่พบช่วงที่ควรตรวจสอบ</div>
        ) : (
          <div className="dq-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ชุมชน</th>
                  <th>ช่วง</th>
                  <th className="num">ความยาว</th>
                  <th>หมวดหมู่</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((r, i) => (
                  <tr key={i}>
                    <td>ชุมชน{r.communityKey}</td>
                    <td>
                      {formatMonthLabel(r.runStart)} – {formatMonthLabel(r.runEnd)}
                    </td>
                    <td className="num">{r.runLengthMonths} เดือน</td>
                    <td>
                      <span
                        className={
                          r.category.includes('ตรวจสอบ') ? 'dq-tag dq-tag--medium' : 'dq-tag dq-tag--low'
                        }
                      >
                        {r.category}
                      </span>
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
