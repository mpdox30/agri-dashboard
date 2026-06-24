// src/pages/approvalQueueHelpers.js
//
// ฟังก์ชันคำนวณล้วน ๆ สำหรับหน้าตรวจสอบ/อนุมัติ แยกจาก React เพื่อให้ทดสอบง่าย

const VALUE_FIELDS = ['บริโภคในครัวเรือน', 'ขาย', 'แบ่งปัน', 'ซื้อ', 'ผลิตเอง', 'รับฟรี/อื่นๆ'];

function memberNetIncome(member) {
  const sale = Number(member['ขาย']) || 0;
  const purchase = Number(member['ซื้อ']) || 0;
  const sharing = Number(member['แบ่งปัน']) || 0;
  return sale - purchase + sharing;
}

function memberPreviousNetIncome(member) {
  if (!member.previous_month_values) return null;
  const sale = Number(member.previous_month_values['ขาย']) || 0;
  const purchase = Number(member.previous_month_values['ซื้อ']) || 0;
  const sharing = Number(member.previous_month_values['แบ่งปัน']) || 0;
  return sale - purchase + sharing;
}

/**
 * สรุปข้อมูลระดับ submission เดียว สำหรับแสดงในแถวคิวและส่วนขยายรายละเอียด
 * รับ submission ตามรูปแบบที่ getPendingSubmissionsForReview() คืนมา (มี members[]
 * พร้อม previous_month_values + anomaly_flags ต่อคนแล้ว)
 */
export function summarizeSubmission(submission) {
  const totalNetIncome = submission.members.reduce((sum, m) => sum + memberNetIncome(m), 0);

  const membersWithPrevious = submission.members.filter((m) => m.previous_month_values);
  const previousTotal = membersWithPrevious.reduce((sum, m) => sum + memberPreviousNetIncome(m), 0);

  const flaggedMembers = submission.members.filter((m) => m.anomaly_flags && m.anomaly_flags.length > 0);

  return {
    totalNetIncome,
    previousTotal: membersWithPrevious.length > 0 ? previousTotal : null,
    memberCount: submission.members.length,
    flaggedMemberCount: flaggedMembers.length,
    isClean: flaggedMembers.length === 0,
  };
}

/**
 * สร้างตาราง diff ต่อสมาชิก (รายได้สุทธิที่ส่งมา vs เดือนก่อน + ช่องที่ถูก flag)
 * เรียงให้สมาชิกที่ถูก flag ขึ้นก่อน
 */
export function buildDiffRows(submission) {
  const rows = submission.members.map((m) => {
    const current = memberNetIncome(m);
    const previous = memberPreviousNetIncome(m);
    const changePct = previous !== null && previous !== 0 ? ((current - previous) / previous) * 100 : null;
    return {
      fullName: m.full_name,
      current,
      previous,
      changePct,
      flags: m.anomaly_flags || [],
    };
  });
  rows.sort((a, b) => b.flags.length - a.flags.length);
  return rows;
}

/** กรอง+เรียง submissions ตามตัวกรองที่ผู้ใช้เลือกในหน้าคิว */
export function filterAndSortSubmissions(submissions, { searchText, statusFilter, sortBy }) {
  let result = submissions;

  if (searchText.trim() !== '') {
    const q = searchText.trim().toLowerCase();
    result = result.filter((s) => s.community_key.toLowerCase().includes(q));
  }

  if (statusFilter === 'flagged') {
    result = result.filter((s) => summarizeSubmission(s).flaggedMemberCount > 0);
  } else if (statusFilter === 'clean') {
    result = result.filter((s) => summarizeSubmission(s).flaggedMemberCount === 0);
  }

  result = [...result];
  if (sortBy === 'community') {
    result.sort((a, b) => a.community_key.localeCompare(b.community_key, 'th'));
  } else {
    result.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  }
  return result;
}

export { VALUE_FIELDS };
