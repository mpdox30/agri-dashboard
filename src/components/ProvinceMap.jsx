// src/components/ProvinceMap.jsx
import { useMemo, useRef } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import thailandProvinces from '../data/thailand_provinces.json';
import './ProvinceMap.css';

function formatMillionBaht(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

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
 *
 * วาดแผนที่ประเทศไทยระดับจังหวัดแบบ choropleth (ไล่สีเข้ม-อ่อนตามรายได้สุทธิ) จาก GeoJSON ที่
 * ฝังไว้ในโปรเจกต์เอง (src/data/thailand_provinces.json — 77 จังหวัด ย่อขนาดจุดแล้วจาก ~1.1MB
 * เหลือ ~105KB ด้วย mapshaper) ไม่ใช้ tile server ภายนอก (ไม่มี basemap จริง/ไม่ต้องต่อเน็ตตอนโหลด)
 * เพราะข้อมูลที่ต้องการสื่อคือ "รายได้ต่อจังหวัดเทียบกัน" ไม่ใช่ตำแหน่งทางภูมิศาสตร์ละเอียด —
 * ยังไม่มีพิกัดรายแปลง (ตามที่ Ton ยืนยัน) จึงยังทำได้แค่ระดับจังหวัด รอข้อมูลพิกัดแปลงจริงในอนาคต
 */
export default function ProvinceMap({ provinceTotals, onSelectProvince }) {
  const geoJsonRef = useRef(null);

  const totalsByProvince = useMemo(() => {
    const map = new Map();
    provinceTotals.forEach((p) => map.set(p.province, p));
    return map;
  }, [provinceTotals]);

  const maxNetIncome = useMemo(
    () => provinceTotals.reduce((max, p) => Math.max(max, p.netIncome), 0),
    [provinceTotals]
  );

  // บังคับให้ layer GeoJSON สร้างใหม่ทุกครั้งที่ข้อมูลเปลี่ยน (เปลี่ยนตัวกรอง/ปี) แทนที่จะ
  // พึ่งกลไก diff ภายในของ react-leaflet เพื่อความชัวร์ว่าสี/tooltip อัปเดตตรงกับข้อมูลจริงเสมอ
  const dataVersion = useMemo(
    () => provinceTotals.map((p) => `${p.province}:${p.netIncome}:${p.communityCount}`).join('|'),
    [provinceTotals]
  );

  function styleForFeature(feature) {
    const provinceName = feature.properties.name_th;
    const stat = totalsByProvince.get(provinceName);
    const hasData = !!stat && stat.netIncome > 0;
    return {
      fillColor: hasData ? colorForShare(maxNetIncome > 0 ? stat.netIncome / maxNetIncome : 0) : NO_DATA_FILL,
      fillOpacity: 1,
      color: '#FFFEFA',
      weight: 1,
      dashArray: hasData ? null : '3,3',
    };
  }

  function onEachFeature(feature, layer) {
    const provinceName = feature.properties.name_th;
    const stat = totalsByProvince.get(provinceName);
    const label = stat
      ? `<b>${provinceName}</b><br/>${formatMillionBaht(stat.netIncome)} ล้านบาท · ${stat.communityCount} ชุมชน`
      : `<b>${provinceName}</b><br/>ไม่มีข้อมูลในช่วงนี้`;
    layer.bindTooltip(label, { sticky: true });
    layer.on({
      mouseover: (e) => e.target.setStyle({ weight: 2.5, color: HOVER_STROKE }),
      mouseout: (e) => {
        if (geoJsonRef.current) geoJsonRef.current.resetStyle(e.target);
      },
      click: () => {
        if (stat) onSelectProvince(provinceName);
      },
    });
  }

  return (
    <div className="province-map">
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
          key={dataVersion}
          ref={geoJsonRef}
          data={thailandProvinces}
          style={styleForFeature}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
      <div className="province-map__legend">
        <span className="province-map__legend-label">รายได้สุทธิน้อย</span>
        <div className="province-map__legend-bar" />
        <span className="province-map__legend-label">รายได้สุทธิมาก</span>
        <span className="province-map__legend-nodata">
          <span className="province-map__legend-swatch province-map__legend-swatch--nodata" /> ไม่มีข้อมูลในช่วงนี้
        </span>
      </div>
    </div>
  );
}
