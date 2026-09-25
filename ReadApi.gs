/**
 * ReadApi.gs — doGet() สำหรับหน้าเว็บอ่านข้อมูล
 *
 * Endpoint ส่วนใหญ่ไม่ต้องใส่รหัสผ่าน เพราะเป็นข้อมูลอ่านอย่างเดียวที่ตั้งใจให้สาธารณะ
 * อยู่แล้ว (หน้าภาพรวม/รายชุมชน) ยกเว้น "pending_review" ที่ต้องใส่รหัสผ่าน เพราะมี
 * ชื่อสมาชิกรายคนของข้อมูลที่ยังไม่ผ่านการอนุมัติ ไม่ควรให้สาธารณะเห็น
 *
 * Endpoints:
 *   ?action=communities                                 -> รายชื่อชุมชนทั้งหมด
 *   ?action=monthly_records&community_key=XXX            -> รายเดือนของชุมชนเดียว (ทุกปี)
 *   ?action=monthly_summary&community_key=XXX            -> สรุปรายเดือนของชุมชนเดียว
 *   ?action=monthly_summary                              -> สรุปรายเดือนทุกชุมชน (สำหรับกราฟรวมประเทศ)
 *   ?action=check_lock&community_key=XXX&month=YYYY-MM   -> เช็คว่ามี submission รออนุมัติสำหรับ
 *                                                            ชุมชน/เดือนนี้อยู่หรือไม่ (ใช้ล็อกฟอร์มกรอก)
 *   ?action=pending_review&password=XXX                  -> [ต้องมีรหัสผ่าน] รายการ submission
 *                                                            ที่รออนุมัติทั้งหมด พร้อม diff เดือนก่อน
 */

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'communities') {
      return jsonResponse({ ok: true, data: readSheetAsObjects(SHEET_COMMUNITIES) });
    }

    if (action === 'monthly_records') {
      const communityKey = e.parameter.community_key;
      let data = readSheetAsObjects(SHEET_MONTHLY_RECORDS);
      if (communityKey) {
        data = data.filter(function (row) { return row.community_key === communityKey; });
      }
      return jsonResponse({ ok: true, data: data });
    }

    if (action === 'monthly_summary') {
      const communityKey = e.parameter.community_key;
      let data = readSheetAsObjects(SHEET_MONTHLY_SUMMARY);
      if (communityKey) {
        data = data.filter(function (row) { return row.community_key === communityKey; });
      }
      return jsonResponse({ ok: true, data: data });
    }

    if (action === 'check_lock') {
      const communityKey = e.parameter.community_key;
      const month = e.parameter.month;
      if (!communityKey || !month) {
        return jsonResponse({ ok: false, error: 'ต้องระบุ community_key และ month' });
      }
      const lockInfo = getLockInfo(communityKey, month);
      return jsonResponse({ ok: true, data: lockInfo });
    }

    if (action === 'pending_review') {
      // ข้อมูลนี้ไม่ใช่สาธารณะ (มีชื่อสมาชิกรายคนของข้อมูลที่ยังไม่อนุมัติ) ต้องใส่รหัสผ่าน
      if (!checkApprovalPassword(e.parameter.password)) {
        return jsonResponse({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
      }
      return jsonResponse({ ok: true, data: getPendingSubmissionsForReview() });
    }

    return jsonResponse({ ok: false, error: 'ไม่รู้จัก action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * เช็คว่า (community_key, month) นี้มีการส่งข้อมูลที่ status=pending อยู่หรือไม่
 * ใช้ทั้งจาก doGet (ให้หน้าฟอร์มเช็คก่อนเปิดให้กรอก) และจาก EntryApi.gs (เช็คซ้ำ
 * อีกครั้งฝั่ง backend ก่อนรับข้อมูลจริง กันกรณีเปิดสองแท็บพร้อมกัน)
 *
 * คืน { locked: true/false, submission: {...} หรือ null }
 */
function getLockInfo(communityKey, month) {
  const allPending = readSheetAsObjects(SHEET_PENDING_SUBMISSIONS);
  const matches = allPending.filter(function (row) {
    return row.community_key === communityKey && row.month === month && row.status === 'pending';
  });
  if (matches.length === 0) {
    return { locked: false, submission: null };
  }
  // ถ้ามีหลายแถว (สมาชิกหลายคนในการส่งเดียวกัน) ดึงข้อมูล metadata จากแถวแรกพอ
  const first = matches[0];
  return {
    locked: true,
    submission: {
      submission_id: first.submission_id,
      submitted_at: first.submitted_at,
    },
  };
}