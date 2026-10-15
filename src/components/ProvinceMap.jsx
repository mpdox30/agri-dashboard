// src/components/ProvinceMap.jsx
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import thailandProvinces from '../data/thailand_provinces.json';
import useInView from './ui/useInView';
import { useMotionDisabled } from './ui/motion';
import './ProvinceMap.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

const LABEL_TOP_N = 5; // ใส่ชื่อกำกับบนแผนที่เฉพาะจังหวัดที่ค่าสูงสุด กันป้ายซ้อนกันบนจอเล็ก

// ไล่สีจากอ่อน (ไม่มี/มีน้อย) ไปเข้ม (มาก) โดยใช้โทนสีเดียวกับธีมเว็บ (var(--line) -> var(--green))
const LIGHT_FILL = [232, 224, 201]; // ~ var(--line) #E3DCC9
const DARK_FILL = [45, 74, 62]; // var(--green) #2D4A3E
const NO_DATA_FILL = '#EDE8D8';
const HOVER_STROKE = '#C17F3E'; // var(--terracotta)

function colorForShare(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const rgb = LIGHT_FILL.map((c, i) => Math.round(c + (DARK_FILL[i] - c) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * props:
 *   provinceTotals: { province: string, netIncome: number, communityCount: number }[]
 *     ข้อมูลชุดเดียวกับที่ ProvinceGrid ใช้ (มาจาก aggregateByProvince() ใน homepageAggregations.js)
 *   onSelectProvince: (province: string) => void — เรียกเมื่อคลิกจังหวัดที่มีข้อมูล (ต่อกับ FilterBar เหมือน ProvinceGrid)
 *   valueKey: 'netIncome' | 'householdReduction' ตัวชี้วัดที่ใช้ลงสี (ค่าเริ่มต้น netIncome)
 *   valueLabel: ชื่อตัวชี้วัดสำหรับ tooltip/คำอธิบายสี
 *   selectedProvince: จังหวัดที่กำลังกรองอยู่ จะถูกเน้นขอบ
 *
 * วาดแผนที่ประเทศไทยระดับจังหวัดแบบ choropleth (ไล่สีเข้ม-อ่อนตามรายได้สุทธิ) จาก GeoJSON ที่
 * ฝังไว้ในโปรเจกต์เอง (src/data/thailand_provinces.json — 77 จังหวัด ย่อขนาดจุดแล้วจาก ~1.1MB
 * เหลือ ~105KB ด้วย mapshaper) ไม่ใช้ tile server ภายนอก (ไม่มี basemap จริง/ไม่ต้องต่อเน็ตตอนโหลด)
 * เพราะข้อมูลที่ต้องการสื่อคือ "รายได้ต่อจังหวัดเทียบกัน" ไม่ใช่ตำแหน่งทางภูมิศาสตร์ละเอียด —
 * ยังไม่มีพิกัดรายแปลง (ตามที่ Ton ยืนยัน) จึงยังทำได้แค่ระดับจังหวัด รอข้อมูลพิกัดแปลงจริงในอนาคต
 */
export default function ProvinceMap({
  provinceTotals,
  onSelectProvince,
  valueKey = 'netIncome',
  valueLabel = 'รายได้สุทธิ',
  selectedProvince = null,
}) {
  const geoJsonRef = useRef(null);
  const motionOff = useMotionDisabled();
  const [viewRef, inView] = useInView({ disabled: motionOff });
  const sweptRef = useRef(false);
  // handler ของ layer ถูกสร้างครั้งเดียว จึงอ่านค่าล่าสุดผ่าน ref (ข้อมูลเปลี่ยนแล้วไม่ต้องสร้าง layer ใหม่
  // สีจึงไล่เปลี่ยนต่อเนื่องตอนเลื่อนเดือน แทนที่จะกระโดดวาบ)
  const latestRef = useRef({});

  const totalsByProvince = useMemo(() => {
    const map = new Map();
    provinceTotals.forEach((p) => map.set(p.province, p));
    return map;
  }, [provinceTotals]);

  const maxValue = useMemo(
    () => provinceTotals.reduce((max, p) => Math.max(max, p[valueKey] || 0), 0),
    [provinceTotals, valueKey]
  );

  // จังหวัดที่ค่าสูงสุด N อันดับแรก ใช้ใส่ชื่อกำกับบนแผนที่
  const topProvinces = useMemo(
    () =>
      new Set(
        [...provinceTotals]
          .filter((p) => (p[valueKey] || 0) > 0)
          .sort((a, b) => b[valueKey] - a[valueKey])
          .slice(0, LABEL_TOP_N)
          .map((p) => p.province)
      ),
    [provinceTotals, valueKey]
  );

  // จุดกึ่งกลางของจังหวัดที่ต้องใส่ชื่อกำกับ (ใช้ CircleMarker โปร่งใสถือ Tooltip ถาวร เพื่อให้ tooltip ตอนชี้เมาส์ของจังหวัดนั้นยังทำงานตามปกติ)
  const labelPoints = useMemo(
    () =>
      thailandProvinces.features
        .filter((f) => topProvinces.has(f.properties.name_th))
        .map((f) => {
          const center = L.geoJSON(f).getBounds().getCenter();
          return { name: f.properties.name_th, position: [center.lat, center.lng] };
        }),
    [topProvinces]
  );

  const dataVersion = useMemo(
    () => provinceTotals.map((p) => `${p.province}:${p[valueKey]}:${p.communityCount}`).join('|') + `|${valueKey}|${selectedProvince}`,
    [provinceTotals, valueKey, selectedProvince]
  );

  function styleForFeature(feature) {
    const provinceName = feature.properties.name_th;
    const stat = totalsByProvince.get(provinceName);
    const value = stat ? stat[valueKey] || 0 : 0;
    const hasData = !!stat && value > 0;
    const isSelected = provinceName === selectedProvince;
    return {
      fillColor: hasData ? colorForShare(maxValue > 0 ? value / maxValue : 0) : NO_DATA_FILL,
      fillOpacity: 1,
      color: isSelected ? HOVER_STROKE : '#FFFEFA',
      weight: isSelected ? 2.5 : 1,
      dashArray: hasData ? null : '3,3',
    };
  }

  function labelForFeature(feature) {
    const provinceName = feature.properties.name_th;
    const stat = totalsByProvince.get(provinceName);
    return stat
      ? `<b>${provinceName}</b><br/>${valueLabel} ${formatBaht(stat[valueKey] || 0)} บาท · ${stat.communityCount} ชุมชน`
      : `<b>${provinceName}</b><br/>ไม่มีข้อมูลในช่วงนี้`;
  }

  // เก็บค่าล่าสุดไว้ให้ handler ที่สร้างครั้งเดียวอ่าน (เขียนใน effect ไม่ใช่ตอนเรนเดอร์)
  useEffect(() => {
    latestRef.current = { styleForFeature, totalsByProvince, onSelectProvince };
  });

  function onEachFeature(feature, layer) {
    const provinceName = feature.properties.name_th;
    layer.bindTooltip(labelForFeature(feature), { sticky: true });
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 2.5, color: HOVER_STROKE });
        e.target.bringToFront();
      },
      mouseout: (e) => e.target.setStyle(latestRef.current.styleForFeature(feature)),
      click: () => {
        if (latestRef.current.totalsByProvince.get(provinceName)) latestRef.current.onSelectProvince(provinceName);
      },
    });
  }

  // ข้อมูลเปลี่ยน: ทาสีและอัปเดตข้อความ tooltip ใน layer เดิม (CSS ทำให้สีไล่เปลี่ยนนุ่มๆ)
  useEffect(() => {
    const group = geoJsonRef.current;
    if (!group) return;
    group.eachLayer((layer) => {
      layer.setStyle(styleForFeature(layer.feature));
      layer.setTooltipContent(labelForFeature(layer.feature));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  // ครั้งแรกที่แผนที่เลื่อนเข้าจอ: จังหวัดผุดขึ้นไล่จากรายได้สูงไปต่ำ (ข้ามถ้าปิดการเคลื่อนไหว)
  useEffect(() => {
    if (motionOff || !inView || sweptRef.current || !geoJsonRef.current) return undefined;
    sweptRef.current = true;
    const ranked = [...provinceTotals].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)).map((p) => p.province);
    const timers = [];
    geoJsonRef.current.eachLayer((layer) => {
      const el = layer.getElement && layer.getElement();
      if (!el) return;
      const rank = ranked.indexOf(layer.feature.properties.name_th);
      const delay = (rank === -1 ? ranked.length : rank) * 28;
      el.style.transition = 'none';
      el.style.opacity = '0';
      timers.push(
        window.setTimeout(() => {
          el.style.transition = 'opacity 0.5s ease-out';
          el.style.opacity = '1';
          timers.push(
            window.setTimeout(() => {
              el.style.transition = '';
              el.style.opacity = '';
            }, 600)
          );
        }, 60 + delay)
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, motionOff]);

  return (
    <div className="province-map" ref={viewRef}>
      <MapContainer
        center={[13.2, 101.3]}
        zoom={5.4}
        zoomSnap={0.1}
        minZoom={4.5}
        maxZoom={8}
        scrollWheelZoom={false}
        attributionControl={false}
        maxBounds={[[3, 94], [22, 109]]}
        maxBoundsViscosity={1.0}
        style={{ height: '460px', width: '100%', background: 'transparent' }}
      >
        <GeoJSON
          ref={geoJsonRef}
          data={thailandProvinces}
          style={styleForFeature}
          onEachFeature={onEachFeature}
        />
        {labelPoints.map((pt) => (
          <CircleMarker key={`${pt.name}-${dataVersion}`} center={pt.position} radius={1} interactive={false} opacity={0} fillOpacity={0}>
            <Tooltip permanent direction="center" className="province-map__label" interactive={false}>
              {pt.name}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="province-map__legend">
        <span className="province-map__legend-label">0</span>
        <div className="province-map__legend-bar" />
        <span className="province-map__legend-label">{formatBaht(maxValue)} บาท ({valueLabel}สูงสุดในช่วงนี้)</span>
        <span className="province-map__legend-nodata">
          <span className="province-map__legend-swatch province-map__legend-swatch--nodata" /> ไม่มีข้อมูลในช่วงนี้
        </span>
      </div>
    </div>
  );
}
