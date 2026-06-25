// src/pages/EntryForm.jsx
import { useEffect, useMemo, useState } from 'react';
import { getCommunities, getMonthlyRecords, checkLock, submitEntry } from '../api/appsScript';
import {
  VALUE_FIELDS,
  formatMonthWithBuddhistYear,
  buildMemberRoster,
  isRowTouched,
  computeRowTotal,
  computeRowFlags,
  getPreviousMonth,
  findSimilarExistingName,
} from './entryFormHelpers';
import { CALENDAR_YEAR_LIST, buildCalendarYearDropdownOptions, enumerateMonths } from './fiscalYears';
import './EntryForm.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let newMemberCounter = 0;

export default function EntryForm() {
  const [communities, setCommunities] = useState([]);
  const [baseLoadState, setBaseLoadState] = useState('loading');
  const [baseLoadError, setBaseLoadError] = useState(null);

  const [communityKey, setCommunityKey] = useState(null);

  const currentYear = String(new Date().getFullYear());
  const defaultYear = CALENDAR_YEAR_LIST.includes(currentYear) ? currentYear : CALENDAR_YEAR_LIST[0];
  const [year, setYear] = useState(defaultYear);
  const yearOptions = useMemo(() => buildCalendarYearDropdownOptions(), []);

  // ตัวเลือกเดือนของปีที่เลือก เรียง ม.ค. -> ธ.ค. ตามปีปฏิทินจริง แต่แสดงจากเดือนล่าสุด
  // ไปเดือนแรกในปีนั้น (ใหม่ -> เก่า) ให้สอดคล้องกับพฤติกรรมเดิมที่ผู้ใช้คุ้นเคย
  const monthOptions = useMemo(() => {
    const months = enumerateMonths(`${year}-01`, `${year}-12`);
    return [...months].reverse();
  }, [year]);

  const [month, setMonth] = useState(() => {
    const nowMonthStr = currentMonthString();
    return monthOptions.includes(nowMonthStr) ? nowMonthStr : monthOptions[0];
  });

  const [recordsForCommunity, setRecordsForCommunity] = useState([]);
  const [recordsLoadState, setRecordsLoadState] = useState('loading');

  const [lockInfo, setLockInfo] = useState(null);
  const [lockLoadState, setLockLoadState] = useState('loading');

  const [rowValues, setRowValues] = useState({}); // { [id]: { field: string } }
  const [newMembers, setNewMembers] = useState([]); // [{ id, fullName, joinYear }]

  const [submittedBy, setSubmittedBy] = useState('');
  const [password, setPassword] = useState('');
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      setBaseLoadState('loading');
      try {
        const data = await getCommunities();
        if (cancelled) return;
        setCommunities(data);
        setBaseLoadState('ready');
        if (data.length > 0) {
          setCommunityKey((prev) => prev || [...data].sort((a, b) => a.community_key.localeCompare(b.community_key, 'th'))[0].community_key);
        }
      } catch (err) {
        if (cancelled) return;
        setBaseLoadError(err.message || String(err));
        setBaseLoadState('error');
      }
    }
    loadBase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!communityKey) return;
    let cancelled = false;
    async function loadRecords() {
      setRecordsLoadState('loading');
      try {
        const data = await getMonthlyRecords(communityKey);
        if (cancelled) return;
        setRecordsForCommunity(data);
        setRecordsLoadState('ready');
      } catch {
        if (cancelled) return;
        setRecordsLoadState('error');
      }
    }
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [communityKey]);

  useEffect(() => {
    if (!communityKey || !month) return;
    let cancelled = false;
    async function loadLock() {
      setLockLoadState('loading');
      try {
        const data = await checkLock(communityKey, month);
        if (cancelled) return;
        setLockInfo(data);
        setLockLoadState('ready');
      } catch {
        if (cancelled) return;
        setLockLoadState('error');
      }
    }
    loadLock();
    return () => {
      cancelled = true;
    };
  }, [communityKey, month]);

  function handleCommunityChange(nextKey) {
    setCommunityKey(nextKey);
    setRowValues({});
    setNewMembers([]);
    setSubmitState('idle');
    setSubmitError(null);
  }

  function handleYearChange(nextYear) {
    const months = enumerateMonths(`${nextYear}-01`, `${nextYear}-12`).reverse();
    const nowMonthStr = currentMonthString();
    const nextMonth = months.includes(nowMonthStr) ? nowMonthStr : months[0];
    setYear(nextYear);
    setMonth(nextMonth);
    setRowValues({});
    setNewMembers([]);
    setSubmitState('idle');
    setSubmitError(null);
  }

  function handleMonthChange(nextMonth) {
    setMonth(nextMonth);
    setRowValues({});
    setNewMembers([]);
    setSubmitState('idle');
    setSubmitError(null);
  }

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.community_key === communityKey) || null,
    [communities, communityKey]
  );

  const roster = useMemo(
    () => (month ? buildMemberRoster(recordsForCommunity, month) : []),
    [recordsForCommunity, month]
  );

  const alreadyApprovedThisMonth = useMemo(
    () => recordsForCommunity.some((r) => r.month === month),
    [recordsForCommunity, month]
  );

  const allRows = useMemo(
    () => [
      ...roster.map((m) => ({ id: m.fullName, fullName: m.fullName, joinYear: m.joinYear, previousValues: m.previousValues, isNew: false })),
      ...newMembers.map((m) => ({ id: m.id, fullName: m.fullName, joinYear: m.joinYear, previousValues: null, isNew: true })),
    ],
    [roster, newMembers]
  );

  // เช็คว่าชื่อสมาชิกใหม่ที่กำลังพิมพ์ คล้ายกับชื่อที่มีอยู่แล้วในรายชื่อ (ทั้งจากข้อมูล
  // เก่าและสมาชิกใหม่ที่เพิ่มไว้ในรอบนี้ด้วยกัน) หรือไม่ — เตือนก่อนส่ง ป้องกันไม่ให้
  // เกิดชื่อซ้ำใหม่เพิ่มขึ้นจากการพิมพ์ผิด/สะกดไม่ตรงกัน (ดู near_duplicate_names.csv
  // ซึ่งพบว่าปัญหานี้มีอยู่จริงทั่วทั้งระบบ 184 คู่ใน 85 ชุมชน)
  const nameSimilarityWarnings = useMemo(() => {
    const warnings = {};
    newMembers.forEach((m) => {
      if (!m.fullName.trim()) return;
      const otherNames = [
        ...roster.map((r) => r.fullName),
        ...newMembers.filter((other) => other.id !== m.id).map((other) => other.fullName),
      ].filter(Boolean);
      const match = findSimilarExistingName(m.fullName, otherNames);
      if (match) warnings[m.id] = match;
    });
    return warnings;
  }, [newMembers, roster]);

  function getRowValues(id) {
    return rowValues[id] || {};
  }

  function handleCellChange(id, field, value) {
    setRowValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function handleCopyPreviousMonth() {
    const next = {};
    allRows.forEach((row) => {
      if (row.previousValues) {
        const values = {};
        VALUE_FIELDS.forEach((f) => {
          values[f] = String(row.previousValues[f] ?? 0);
        });
        next[row.id] = values;
      }
    });
    setRowValues(next);
  }

  function handleClearAll() {
    setRowValues({});
  }

  function handleAddMember() {
    newMemberCounter += 1;
    const id = `__new_${newMemberCounter}`;
    setNewMembers((prev) => [...prev, { id, fullName: '', joinYear: '' }]);
  }

  function handleNewMemberFieldChange(id, field, value) {
    setNewMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  function handleRemoveNewMember(id) {
    setNewMembers((prev) => prev.filter((m) => m.id !== id));
    setRowValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const touchedRows = allRows.filter((row) => isRowTouched(getRowValues(row.id)));
  const flaggedCellCount = touchedRows.reduce(
    (sum, row) => sum + computeRowFlags(getRowValues(row.id), row.previousValues).length,
    0
  );
  const netIncomeTotal = touchedRows.reduce((sum, row) => sum + computeRowTotal(getRowValues(row.id)), 0);

  const previousMonthAverage = useMemo(() => {
    const prevRows = roster.filter((m) => m.previousValues);
    if (prevRows.length === 0) return null;
    const total = prevRows.reduce((sum, m) => {
      const sale = Number(m.previousValues['ขาย']) || 0;
      const purchase = Number(m.previousValues['ซื้อ']) || 0;
      const sharing = Number(m.previousValues['แบ่งปัน']) || 0;
      return sum + (sale - purchase + sharing);
    }, 0);
    return total / prevRows.length;
  }, [roster]);

  const currentAveragePerTouched = touchedRows.length > 0 ? netIncomeTotal / touchedRows.length : null;

  // เดือนที่เลือกย้อนหลังจากเดือนปัจจุบันจริงเกิน 2 เดือน ถือว่าเป็นการ "กรอกย้อนหลัง"
  // เพื่อเติมข้อมูลเก่าที่ขาดไว้ — ไม่ใช่การกรอกตามรอบปกติ จึงเตือนไว้กันเลือกเดือนผิด
  const isBackdated = useMemo(() => {
    const nowStr = currentMonthString();
    const [nowY, nowM] = nowStr.split('-').map(Number);
    const [selY, selM] = month.split('-').map(Number);
    const monthsDiff = (nowY - selY) * 12 + (nowM - selM);
    return monthsDiff > 2;
  }, [month]);

  const isLocked = lockInfo && lockInfo.locked;
  const canSubmit =
    !isLocked &&
    submitState !== 'submitting' &&
    touchedRows.length > 0 &&
    password.trim() !== '' &&
    submittedBy.trim() !== '' &&
    newMembers.every((m) => m.fullName.trim() !== ''); // สมาชิกใหม่ต้องกรอกชื่อก่อนส่งได้

  async function handleSubmit() {
    setSubmitState('submitting');
    setSubmitError(null);
    const members = touchedRows.map((row) => {
      const values = getRowValues(row.id);
      const memberPayload = { full_name: row.fullName, join_year: row.joinYear || '' };
      VALUE_FIELDS.forEach((f) => {
        memberPayload[f] = Number(values[f]) || 0;
      });
      return memberPayload;
    });

    try {
      await submitEntry({ password, communityKey, month, submittedBy, members });
      setSubmitState('success');
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err.message || String(err));
    }
  }

  if (baseLoadState === 'loading') {
    return (
      <div className="entry-status">
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }
  if (baseLoadState === 'error') {
    return (
      <div className="entry-status entry-status--error">
        <p>โหลดข้อมูลไม่สำเร็จ: {baseLoadError}</p>
      </div>
    );
  }

  if (submitState === 'success') {
    return (
      <div className="entry-view">
        <div className="success-panel">
          <div className="success-icon">✓</div>
          <h2>ส่งข้อมูลสำเร็จ</h2>
          <p>
            ข้อมูลเดือน {formatMonthWithBuddhistYear(month)} ของชุมชน{communityKey} เข้าสู่สถานะ
            "รอตรวจสอบ" แล้ว ทีมกลางจะตรวจสอบและอนุมัติก่อนข้อมูลแสดงในหน้าภาพรวมและหน้าสาธารณะ
          </p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            กรอกข้อมูลชุมชน/เดือนอื่นต่อ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="entry-view">
      <div className="entry-hero">
        <div className="entry-breadcrumb">กรอกข้อมูล · เลือกชุมชนและเดือน</div>

        <div className="picker-row">
          <div className="control-group">
            <label>ชุมชน</label>
            <select value={communityKey || ''} onChange={(e) => handleCommunityChange(e.target.value)}>
              {communities.map((c) => (
                <option key={c.community_key} value={c.community_key}>
                  ชุมชน{c.community_key} ({c.province})
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>ปี</label>
            <select value={year} onChange={(e) => handleYearChange(e.target.value)}>
              {yearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>เดือนที่กรอก</label>
            <select value={month} onChange={(e) => handleMonthChange(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMonthWithBuddhistYear(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>ชื่อผู้กรอก</label>
            <input
              type="text"
              placeholder="เช่น พิเชฐ"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
            />
          </div>
        </div>

        {lockLoadState === 'ready' && isLocked && (
          <div className="locked-banner">
            🔒 <b>เดือน {formatMonthWithBuddhistYear(month)} มีข้อมูลที่ส่งไปแล้วและกำลังรอตรวจสอบ</b> —
            ไม่สามารถกรอกซ้ำได้จนกว่าทีมกลางจะตรวจสอบเสร็จ ส่งเมื่อ {lockInfo.submission.submitted_at}
          </div>
        )}

        {isBackdated && (
          <div className="warning-banner">
            🕓 <b>กำลังกรอกข้อมูลย้อนหลังเดือน {formatMonthWithBuddhistYear(month)}</b> —
            ตรวจสอบให้แน่ใจว่าเลือกปี/เดือนถูกต้องแล้ว ก่อนกรอกข้อมูลเพื่อเติมส่วนที่ขาดหายไปของเดือนนี้
          </div>
        )}

        {!isLocked && alreadyApprovedThisMonth && (
          <div className="warning-banner">
            ⚑ <b>เดือนนี้มีข้อมูลที่อนุมัติแล้วอยู่ในระบบแล้ว</b> — ถ้าส่งซ้ำอีกครั้งจะมีข้อมูลซ้ำกัน
            สองชุดสำหรับเดือนนี้ ตรวจสอบให้แน่ใจก่อนว่าตั้งใจจะแก้ไขข้อมูลเดือนนี้จริง ๆ ไม่ใช่เผลอเลือกเดือนผิด
          </div>
        )}

        {selectedCommunity && (
          <div className="comm-banner">
            <div>
              <h1>
                ชุมชน{selectedCommunity.community_key} — กรอกข้อมูลเดือน{' '}
                {formatMonthWithBuddhistYear(month)}
              </h1>
              <div className="comm-meta">
                ต.{selectedCommunity.subdistrict} อ.{selectedCommunity.district} จ.
                {selectedCommunity.province} · สมาชิกในระบบ {roster.length} คน
              </div>
            </div>
            <span className="progress-pill">
              กรอกแล้ว {touchedRows.length} / {allRows.length} คน
            </span>
          </div>
        )}
      </div>

      {recordsLoadState === 'loading' ? (
        <div className="entry-status">
          <p>กำลังโหลดรายชื่อสมาชิก...</p>
        </div>
      ) : isLocked ? null : (
        <div className="section">
          <div className="toolbar">
            <span className="toolbar-left">
              เคล็ดลับ: ค่าสีเทาใต้ช่องคือยอดเดือนก่อน ({formatMonthWithBuddhistYear(getPreviousMonth(month))}) ไว้เทียบ
            </span>
            <div className="toolbar-right">
              <button type="button" className="btn-sm" onClick={handleCopyPreviousMonth}>
                คัดลอกยอดเดือนก่อนทั้งหมด
              </button>
              <button type="button" className="btn-sm" onClick={handleClearAll}>
                ล้างทุกช่อง
              </button>
              <button type="button" className="btn-sm" onClick={handleAddMember}>
                + เพิ่มสมาชิกใหม่
              </button>
            </div>
          </div>

          <div className="entry-table-scroll">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>สมาชิก</th>
                  {VALUE_FIELDS.map((f) => (
                    <th className="num" key={f}>
                      {f} (฿)
                    </th>
                  ))}
                  <th className="num">รวม</th>
                  <th className="flag-cell" />
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => {
                  const values = getRowValues(row.id);
                  const touched = isRowTouched(values);
                  const flags = computeRowFlags(values, row.previousValues);
                  return (
                    <tr key={row.id}>
                      <td className="member-name-cell">
                        {row.isNew ? (
                          <>
                            <input
                              type="text"
                              className="new-member-name-input"
                              placeholder="ชื่อสมาชิกใหม่"
                              value={row.fullName}
                              onChange={(e) => handleNewMemberFieldChange(row.id, 'fullName', e.target.value)}
                            />
                            <button
                              type="button"
                              className="remove-new-member-btn"
                              onClick={() => handleRemoveNewMember(row.id)}
                              aria-label="ลบสมาชิกใหม่นี้"
                            >
                              ✕
                            </button>
                            {nameSimilarityWarnings[row.id] && (
                              <div className="name-similarity-warning">
                                ⚑ ชื่อนี้คล้ายกับ "{nameSimilarityWarnings[row.id]}" ที่มีอยู่แล้ว — ใช่คนเดียวกัน
                                หรือไม่? ถ้าใช่ ให้ลบแถวนี้แล้วกรอกในแถวเดิมแทน ไม่ใช่เพิ่มเป็นคนใหม่
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {row.fullName}
                            <div className="member-sub">เข้าร่วมปี {row.joinYear || 'ไม่ระบุ'}</div>
                          </>
                        )}
                      </td>
                      {VALUE_FIELDS.map((f) => (
                        <td key={f}>
                          <div className="cell-input-wrap">
                            <input
                              className="cell-input"
                              placeholder="0"
                              inputMode="numeric"
                              value={values[f] ?? ''}
                              onChange={(e) => handleCellChange(row.id, f, e.target.value)}
                            />
                            {row.previousValues && (
                              <span className="cell-prev">{formatBaht(row.previousValues[f])}</span>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="row-total-cell">{touched ? formatBaht(computeRowTotal(values)) : '—'}</td>
                      <td className="flag-cell">
                        {flags.length > 0 && (
                          <span
                            className="flag-icon"
                            title={`ช่องที่เปลี่ยนจากเดือนก่อนเกิน 300%: ${flags.join(', ')}`}
                          >
                            ⚑
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="summary-bar">
            <div className="summary-card">
              <div className="summary-label">รายได้สุทธิรวม (กรอกแล้ว)</div>
              <div className="summary-val">{formatBaht(netIncomeTotal)} ฿</div>
              <div className="summary-delta">จาก {touchedRows.length}/{allRows.length} คนที่กรอกแล้ว</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">เฉลี่ย/คน เทียบเดือนก่อน</div>
              <div className="summary-val">
                {currentAveragePerTouched !== null ? formatBaht(currentAveragePerTouched) + ' ฿' : '—'}
              </div>
              <div className="summary-delta">
                {previousMonthAverage !== null ? `เดือนก่อนเฉลี่ย ${formatBaht(previousMonthAverage)} ฿` : 'ไม่มีข้อมูลเดือนก่อนเทียบ'}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">ช่องที่ระบบตั้งคำถาม</div>
              <div className="summary-val">{flaggedCellCount} ช่อง</div>
              <div className={flaggedCellCount > 0 ? 'summary-delta warn' : 'summary-delta'}>
                {flaggedCellCount > 0 ? 'ดูไอคอน ⚑ ในตาราง' : 'ไม่มีช่องที่ต้องสังเกต'}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">สถานะการกรอก</div>
              <div className="summary-val">ร่าง (ยังไม่ส่ง)</div>
              <div className="summary-delta">ข้อมูลจะหายถ้าออกจากหน้านี้ก่อนกดส่ง</div>
            </div>
          </div>

          <div className="needs-input">
            <b>⚑ พฤติกรรมการเตือนที่ออกแบบไว้:</b> ระบบเทียบแต่ละช่องกับยอดเดือนก่อนของคนเดียวกัน
            ถ้าต่างเกิน ±300% จะขึ้นไอคอน ⚑ ให้ทบทวนก่อนส่ง — ไม่ได้บังคับห้ามส่ง (อาจเป็นรายได้เปลี่ยนแปลงจริง)
            แต่บังคับให้เห็นและยืนยันก่อน
          </div>

          <div className="control-group password-group">
            <label>รหัสผ่านสำหรับส่งข้อมูล</label>
            <input
              type="password"
              placeholder="รหัสผ่านที่ใช้ร่วมกันทั้งระบบ"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {submitState === 'error' && (
            <div className="error-banner">ส่งข้อมูลไม่สำเร็จ: {submitError}</div>
          )}

          <div className="submit-bar">
            <div className="submit-note">
              การส่งข้อมูลจะเข้าสู่สถานะ "รอตรวจสอบ" ทีมกลางจะตรวจสอบและอนุมัติก่อนข้อมูลแสดงในหน้าภาพรวมและหน้าสาธารณะ
            </div>
            <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {submitState === 'submitting' ? 'กำลังส่ง...' : 'ส่งข้อมูลเพื่อตรวจสอบ →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
