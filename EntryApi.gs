/**
 * EntryApi.gs — doPost() จุดเดียวสำหรับ "เขียน" ข้อมูลทั้งหมด (Apps Script รองรับ
 * doPost ได้แค่ 1 ฟังก์ชันต่อโปรเจกต์ จึงต้องรวมทุก action ที่ต้องเขียนข้อมูลไว้ที่นี่
 * แล้วแยกเส้นทางด้วยฟิลด์ "action" ในตัว body)
 *
 * action ที่รองรับ:
 *   "submit_entry"        — ส่งข้อมูลจากฟอร์มกรอกข้อมูล เขียนเข้า pending_submissions
 *   "approve_submission"  — อนุมัติ submission_id ที่ระบุ (ดูรายละเอียดใน ApprovalApi.gs)
 *   "reject_submission"   — ตีกลับ submission_id ที่ระบุ (ดูรายละเอียดใน ApprovalApi.gs)
 *
 * รูปแบบ request body สำหรับ action="submit_entry":
 * {
 *   "action": "submit_entry",
 *   "password": "...",
 *   "community_key": "ป่าภูถ้ำ",
 *   "month": "2026-04",
 *   "submitted_by": "พิเชฐ",
 *   "members": [
 *     { "full_name": "...", "join_year": "2557",
 *       "บริโภคในครัวเรือน": 400, "ขาย": 4500, "แบ่งปัน": 500,
 *       "ซื้อ": 500, "ผลิตเอง": 0, "รับฟรี/อื่นๆ": 0 },
 *     ...
 *   ]
 * }
 *
 * ตรวจสอบ 3 ชั้นก่อนเขียนข้อมูลจริง (ตามลำดับ):
 *   1. รหัสผ่านถูกต้อง
 *   2. มีข้อมูลครบ (community_key, month, members ไม่ว่าง)
 *   3. ไม่มี submission ที่ status=pending ของ (community_key, month) นี้อยู่แล้ว
 *      (เช็คฝั่ง backend เสมอ ไม่เชื่อแค่ฝั่ง frontend — กันเปิดสองแท็บส่งพร้อมกัน)
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'approve_submission') {
      return handleApproveSubmission(body);
    }
    if (action === 'reject_submission') {
      return handleRejectSubmission(body);
    }
    if (action && action !== 'submit_entry') {
      return jsonResponse({ ok: false, error: 'ไม่รู้จัก action: ' + action });
    }

    // ค่าเริ่มต้น (หรือ action === 'submit_entry'): ส่งข้อมูลจากฟอร์มกรอก
    return handleSubmitEntry(body);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function handleSubmitEntry(body) {
  // --- ชั้นที่ 1: รหัสผ่าน ---
  if (!checkEntryPassword(body.password)) {
    return jsonResponse({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
  }

  // --- ชั้นที่ 2: ข้อมูลครบ ---
  const communityKey = body.community_key;
  const month = body.month;
  const submittedBy = body.submitted_by || '(ไม่ระบุชื่อผู้ส่ง)';
  const members = body.members;

  if (!communityKey || !month) {
    return jsonResponse({ ok: false, error: 'ต้องระบุ community_key และ month' });
  }
  if (!members || !Array.isArray(members) || members.length === 0) {
    return jsonResponse({ ok: false, error: 'ไม่มีข้อมูลสมาชิกที่จะบันทึก' });
  }

  // --- ชั้นที่ 3: เช็คล็อกซ้ำฝั่ง backend ---
  const lockInfo = getLockInfo(communityKey, month);
  if (lockInfo.locked) {
    return jsonResponse({
      ok: false,
      error: 'เดือนนี้มีข้อมูลรอตรวจสอบอยู่แล้ว ส่งเมื่อ ' + lockInfo.submission.submitted_at,
      locked: true,
    });
  }

  // --- ผ่านทุกชั้น: เขียนข้อมูลเข้า pending_submissions ---
  const submissionId = generateSubmissionId(communityKey);
  const submittedAt = formatDateTime(new Date());

  const rowObjects = members.map(function (m) {
    const row = {
      submission_id: submissionId,
      community_key: communityKey,
      month: month,
      submitted_by: submittedBy,
      submitted_at: submittedAt,
      status: 'pending',
      reviewer_note: '',
      reviewed_at: '',
      full_name: m.full_name || '',
      join_year: m.join_year || '',
    };
    VALUE_FIELDS.forEach(function (field) {
      const v = m[field];
      row[field] = (typeof v === 'number') ? v : (Number(v) || 0);
    });
    return row;
  });

  appendRowsToSheet(SHEET_PENDING_SUBMISSIONS, PENDING_COLS, rowObjects);

  return jsonResponse({
    ok: true,
    submission_id: submissionId,
    submitted_at: submittedAt,
    member_count: rowObjects.length,
  });
}