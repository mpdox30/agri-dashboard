// src/pages/ApprovalQueue.jsx
import { useMemo, useState } from 'react';
import { getPendingReview, approveSubmission, rejectSubmission } from '../api/appsScript';
import { formatMonthWithBuddhistYear } from './entryFormHelpers';
import { summarizeSubmission, buildDiffRows, filterAndSortSubmissions } from './approvalQueueHelpers';
import './ApprovalQueue.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

export default function ApprovalQueue() {
  const [password, setPassword] = useState('');
  const [authState, setAuthState] = useState('idle'); // idle | loading | ready | error
  const [authError, setAuthError] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [expandedId, setExpandedId] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthState('loading');
    setAuthError(null);
    try {
      const data = await getPendingReview(password);
      setSubmissions(data);
      setAuthState('ready');
    } catch (err) {
      setAuthState('error');
      setAuthError(err.message || String(err));
    }
  }

  async function refetch() {
    try {
      const data = await getPendingReview(password);
      setSubmissions(data);
    } catch {
      // เงียบไว้ตรงนี้ — ถ้า refetch ไม่สำเร็จ รายการเดิมยังแสดงอยู่ ดีกว่าหน้าจอพัง
    }
  }

  const visibleSubmissions = useMemo(
    () => filterAndSortSubmissions(submissions, { searchText, statusFilter, sortBy }),
    [submissions, searchText, statusFilter, sortBy]
  );

  const pendingCount = submissions.length;

  if (authState !== 'ready') {
    return (
      <div className="approval-view">
        <div className="login-panel">
          <h2>เข้าสู่หน้าตรวจสอบและอนุมัติข้อมูล</h2>
          <p>หน้านี้แสดงชื่อสมาชิกรายคนของข้อมูลที่ยังไม่อนุมัติ ต้องใส่รหัสผ่านร่วมของระบบก่อน</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={authState === 'loading'}>
              {authState === 'loading' ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          {authState === 'error' && <div className="error-banner">{authError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="approval-view">
      <div className="hero">
        <h1>คิวตรวจสอบและอนุมัติข้อมูล</h1>
        <p className="sub">ข้อมูลที่ตัวแทนพื้นที่ส่งเข้ามาจะรออยู่ที่นี่ก่อนเข้าสู่ระบบจริง</p>

        <div className="queue-stats">
          <div className="qstat pending">
            🕐 รอตรวจสอบ <b>{pendingCount}</b> รายการ
          </div>
          <div className="qstat note">
            หมายเหตุ: สถิติ "อนุมัติแล้ว/ตีกลับใน 7 วันล่าสุด" ยังแสดงไม่ได้ในขั้นนี้ — ต้องเพิ่ม
            endpoint อ่านประวัติ pending_submissions ทุกสถานะ (ตอนนี้ระบบอ่านได้แค่ที่ยัง
            รอตรวจสอบ)
          </div>
        </div>
      </div>

      <div className="section">
        <div className="filters">
          <input
            type="text"
            placeholder="ค้นหาชุมชน..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="flagged">มีจุดต้องสังเกต ⚑</option>
            <option value="clean">ปกติ</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">เรียงตามวันที่ส่งล่าสุด</option>
            <option value="community">เรียงตามชื่อชุมชน</option>
          </select>
        </div>

        {visibleSubmissions.length === 0 ? (
          <div className="empty-note">ไม่มีรายการที่ตรงกับตัวกรอง</div>
        ) : (
          visibleSubmissions.map((submission) => (
            <QueueCard
              key={submission.submission_id}
              submission={submission}
              expanded={expandedId === submission.submission_id}
              onToggle={() =>
                setExpandedId((prev) => (prev === submission.submission_id ? null : submission.submission_id))
              }
              password={password}
              onActionComplete={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}

function QueueCard({ submission, expanded, onToggle, password, onActionComplete }) {
  const summary = summarizeSubmission(submission);
  const diffRows = useMemo(() => (expanded ? buildDiffRows(submission) : []), [expanded, submission]);
  const [reviewerNote, setReviewerNote] = useState('');
  const [actionState, setActionState] = useState('idle'); // idle | submitting | error
  const [actionError, setActionError] = useState(null);

  async function handleApprove() {
    setActionState('submitting');
    setActionError(null);
    try {
      await approveSubmission({ password, submissionId: submission.submission_id, reviewerNote });
      await onActionComplete();
    } catch (err) {
      setActionState('error');
      setActionError(err.message || String(err));
    }
  }

  async function handleReject() {
    if (reviewerNote.trim() === '') {
      setActionState('error');
      setActionError('กรุณาระบุเหตุผลที่ตีกลับในกล่องหมายเหตุก่อน');
      return;
    }
    setActionState('submitting');
    setActionError(null);
    try {
      await rejectSubmission({ password, submissionId: submission.submission_id, reviewerNote });
      await onActionComplete();
    } catch (err) {
      setActionState('error');
      setActionError(err.message || String(err));
    }
  }

  return (
    <div className={expanded ? 'queue-card expanded' : 'queue-card'}>
      <div className="queue-head" onClick={onToggle}>
        <div className="queue-head-left">
          <div>
            <div className="queue-comm">
              ชุมชน{submission.community_key} — {formatMonthWithBuddhistYear(submission.month)}
            </div>
            <div className="queue-meta">
              ส่งโดย {submission.submitted_by} · {submission.submitted_at} · {summary.memberCount} สมาชิก
            </div>
          </div>
        </div>
        <div className="queue-head-right">
          {summary.isClean ? (
            <span className="status-tag clean">ปกติ ไม่มีจุดต้องสังเกต</span>
          ) : (
            <span className="status-tag flagged">⚑ มี {summary.flaggedMemberCount} คนที่ต้องสังเกต</span>
          )}
          <span className="chevron">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && (
        <div className="queue-body">
          <div className="summary-row">
            <div className="summary-box">
              <div className="summary-box-label">รายได้สุทธิรวม (ส่งมา)</div>
              <div className="summary-box-val">{formatBaht(summary.totalNetIncome)} ฿</div>
            </div>
            <div className="summary-box">
              <div className="summary-box-label">เทียบเดือนก่อน</div>
              <div className="summary-box-val">
                {summary.previousTotal !== null ? formatBaht(summary.previousTotal) + ' ฿' : 'ไม่มีข้อมูลเทียบ'}
              </div>
            </div>
            <div className="summary-box">
              <div className="summary-box-label">สมาชิกที่มีจุดต้องสังเกต</div>
              <div className="summary-box-val">{summary.flaggedMemberCount} คน</div>
            </div>
            <div className="summary-box">
              <div className="summary-box-label">สมาชิกที่ส่งข้อมูลเดือนนี้</div>
              <div className="summary-box-val">{summary.memberCount} คน</div>
            </div>
          </div>

          <table className="diff-table">
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>รายได้สุทธิ (ส่งมา)</th>
                <th>รายได้สุทธิ (เดือนก่อน)</th>
                <th>ผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row) => (
                <tr key={row.fullName} className={row.flags.length > 0 ? 'flagged-row' : ''}>
                  <td>{row.fullName}</td>
                  <td>{formatBaht(row.current)}</td>
                  <td>{row.previous !== null ? formatBaht(row.previous) : 'ไม่มีข้อมูล'}</td>
                  <td className={row.changePct !== null && row.changePct > 0 ? 'diff-cell-up' : 'diff-cell-down'}>
                    {row.changePct !== null ? `${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(1)}%` : '—'}
                    {row.flags.length > 0 && (
                      <span className="diff-flag-note"> (⚑ {row.flags.join(', ')})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="reviewer-note-box">
            <label>หมายเหตุผู้ตรวจสอบ (จำเป็นถ้าจะตีกลับ)</label>
            <textarea
              placeholder="เช่น โทรสอบถามตัวแทนพื้นที่แล้ว ยืนยันว่าขายแปลงรวมได้จริงเดือนนี้ ไม่ใช่พิมพ์ผิด..."
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
            />
          </div>

          {actionState === 'error' && <div className="error-banner">{actionError}</div>}

          <div className="action-row">
            <button
              type="button"
              className="btn btn-reject"
              disabled={actionState === 'submitting'}
              onClick={handleReject}
            >
              ✕ ตีกลับให้แก้ไข
            </button>
            <button
              type="button"
              className="btn btn-approve"
              disabled={actionState === 'submitting'}
              onClick={handleApprove}
            >
              {actionState === 'submitting' ? 'กำลังบันทึก...' : '✓ อนุมัติเข้าระบบ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
