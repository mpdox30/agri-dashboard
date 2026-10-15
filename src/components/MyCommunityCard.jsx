// src/components/MyCommunityCard.jsx
//
// การ์ด "ชุมชนของฉัน": ผู้ชมเลือกชุมชนของตัวเองครั้งเดียว เว็บจะจำไว้ในเครื่อง แล้วสรุปให้ทุกครั้งที่กลับมา
// พร้อมบอกว่าตั้งแต่ครั้งก่อนที่เข้ามามีข้อมูลใหม่อะไรบ้าง ไม่ส่งข้อมูลการเลือกไปที่ใดนอกเครื่องผู้ชม
import { useMemo } from 'react';
import Card from './ui/Card';
import Reveal from './ui/Reveal';
import CountUp from './ui/CountUp';
import DeltaBadge from './ui/DeltaBadge';
import Sparkline from './ui/Sparkline';
import { formatMonthLabel } from '../pages/fiscalYears';
import './MyCommunityCard.css';

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function monthWithYear(monthStr) {
  const [y] = monthStr.split('-').map(Number);
  return `${formatMonthLabel(monthStr)} ${y + 543}`;
}

function daysAgoText(days) {
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  return `${formatInteger(days)} วันที่แล้ว`;
}

function SinceLastVisit({ since }) {
  if (!since) {
    return <p className="my-community__since">ครั้งหน้าที่กลับมา เราจะบอกว่ามีข้อมูลใหม่อะไรเข้ามาบ้าง</p>;
  }
  if (since.newRowsTotal === 0) {
    return (
      <p className="my-community__since">
        ตั้งแต่ครั้งก่อนที่เข้ามา ({daysAgoText(since.daysAgo)}) ยังไม่มีข้อมูลใหม่เข้าระบบ
      </p>
    );
  }
  return (
    <p className="my-community__since">
      ตั้งแต่ครั้งก่อนที่เข้ามา ({daysAgoText(since.daysAgo)}) มีข้อมูลใหม่เข้าระบบ {formatInteger(since.newRowsTotal)} รายการเดือนต่อชุมชน
      {since.newRowsMine > 0 && <> โดยเป็นของชุมชนคุณ {formatInteger(since.newRowsMine)} เดือน</>}
      {since.latestMonthChanged && <> และข้อมูลล่าสุดขยับจากเดือน {monthWithYear(since.previousLatestMonth)} ไปแล้ว</>}
    </p>
  );
}

/**
 * props:
 *   communities: { community_key, province }[]
 *   myKey: community_key ที่เลือกไว้ หรือ null
 *   onChangeMyKey: (key|null) => void
 *   summary: ผลจาก summarizeCommunity() หรือ null
 *   scopeLabel: ป้ายช่วงที่ดูอยู่ เช่น "ปีงบ 68–69"
 *   since: ผลจาก describeSinceLastVisit() หรือ null
 *   onFocusCommunity: (key) => void  กรองหน้านี้ให้ดูเฉพาะชุมชนนี้
 */
export default function MyCommunityCard({ communities, myKey, onChangeMyKey, summary, scopeLabel, since, onFocusCommunity }) {
  const grouped = useMemo(() => {
    const map = new Map();
    communities.forEach((c) => {
      const list = map.get(c.province) || [];
      list.push(c);
      map.set(c.province, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'th'))
      .map(([province, list]) => [province, [...list].sort((a, b) => a.community_key.localeCompare(b.community_key, 'th'))]);
  }, [communities]);

  const select = (
    <label className="my-community__picker">
      <span className="sr-only">เลือกชุมชนของฉัน</span>
      <select value={myKey || ''} onChange={(e) => onChangeMyKey(e.target.value || null)}>
        <option value="">{myKey ? 'ไม่ติดตามชุมชนใด' : 'เลือกชุมชนของฉัน...'}</option>
        {grouped.map(([province, list]) => (
          <optgroup key={province} label={province}>
            {list.map((c) => (
              <option key={c.community_key} value={c.community_key}>
                ชุมชน{c.community_key}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  return (
    <Reveal className="my-community">
      <Card tone="calm">
        <div className="my-community__head">
          <div className="my-community__title">ชุมชนของฉัน</div>
          {select}
        </div>

        {!myKey && (
          <p className="my-community__hint">
            เลือกชุมชนที่คุณสังกัด เว็บจะจำไว้ในเครื่องนี้ แล้วสรุปให้ทุกครั้งที่กลับมาพร้อมบอกว่ามีข้อมูลใหม่อะไรบ้าง
          </p>
        )}

        {myKey && !summary && <p className="my-community__hint">เลือกปีให้เป็นปีใดปีหนึ่งเพื่อดูสรุปของชุมชนนี้</p>}

        {myKey && summary && summary.monthsWithData === 0 && (
          <p className="my-community__hint">ชุมชน{myKey}ยังไม่มีข้อมูลใน{scopeLabel}</p>
        )}

        {myKey && summary && summary.monthsWithData > 0 && (
          <div className="my-community__body">
            <div className="my-community__main">
              <div className="my-community__label">รายได้สุทธิของชุมชน{myKey} · {scopeLabel}</div>
              <div className="my-community__value">
                <CountUp value={summary.netIncome} format={formatInteger} />
                <span className="my-community__unit">บาท</span>
              </div>
              {summary.deltaPct !== null && <DeltaBadge value={summary.deltaPct} suffix="จากเดือนเดียวกันของปีก่อน" />}
              {summary.provinceRank && (
                <div className="my-community__rank">
                  อันดับที่ {formatInteger(summary.provinceRank.rank)} จาก {formatInteger(summary.provinceRank.total)} ชุมชนในจังหวัดเดียวกัน
                </div>
              )}
            </div>
            <div className="my-community__spark">
              <Sparkline
                values={summary.series}
                width={150}
                height={44}
                color="var(--green-soft)"
                label={`แนวโน้มรายได้สุทธิรายเดือนของชุมชน${myKey}`}
              />
              <div className="my-community__spark-note">{formatInteger(summary.monthsWithData)} เดือนที่มีข้อมูล</div>
            </div>
          </div>
        )}

        {myKey && (
          <div className="my-community__foot">
            <SinceLastVisit since={since} />
            <button type="button" className="my-community__focus" onClick={() => onFocusCommunity(myKey)}>
              ดูเฉพาะชุมชนนี้
            </button>
          </div>
        )}
      </Card>
    </Reveal>
  );
}
