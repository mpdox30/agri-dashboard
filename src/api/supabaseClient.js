// src/api/supabaseClient.js
//
// Supabase client เดียวสำหรับทั้งแอป ชี้ไปที่ schema `agri_income` โดย default
// (แยกจาก schema `public` ของโปรเจกต์ Water_dashboard ที่ใช้ร่วมกับระบบอื่น)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://khfixycxjwxcpayiwxap.supabase.co';
// publishable key (เดิมเรียก "anon key") - ปลอดภัยที่จะฝังในโค้ด frontend ได้ตามปกติ
// เพราะสิทธิ์การเข้าถึงจริงถูกควบคุมด้วย Row Level Security (RLS) ฝั่ง Postgres
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1Iju7_QORaqhtYE4HryrGQ_KzYGx_1i';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: 'agri_income' },
});
