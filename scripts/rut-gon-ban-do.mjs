// Rút gọn bản đồ 34 tỉnh thành cả nước xuống còn phần Đồng bằng sông Cửu Long.
//
// File gốc tải về nặng ~16 MB vì chứa cả 34 tỉnh, kể cả quần đảo Trường Sa –
// Hoàng Sa, với toạ độ 15 chữ số thập phân. Trang /ban-do chỉ cần 5 tỉnh miền Tây.
//
// Cách dùng:
//   node scripts/rut-gon-ban-do.mjs <file-goc.geojson> [file-ra.geojson]
//
// Mặc định ghi ra public/data/dbscl.geojson.
// Chỉ chạy lại khi có file bản đồ gốc mới; file kết quả đã được commit sẵn.

import { readFileSync, writeFileSync } from 'node:fs';

// Danh sách tỉnh giữ lại lấy từ src/data/tinh-thanh.json — cùng nguồn với
// src/lib/tinhThanh.ts, thêm bớt tỉnh chỉ cần sửa một chỗ.
// LƯU Ý: file bản đồ gốc gán nhầm nhãn "Lạng Sơn" cho hình của tỉnh Đồng Tháp
// (mã 31), nên tên lấy theo bảng này chứ không lấy theo thuộc tính TinhThanh.
const TINH_DBSCL = Object.fromEntries(
  JSON.parse(readFileSync('src/data/tinh-thanh.json', 'utf8')).map((t) => [t.ma, t.ten])
);

// Sai số khi làm mượt đường biên, tính bằng độ (0.0012 độ ≈ 130 m).
// Bản đồ chỉ zoom tối đa mức 12 nên mắt thường không phân biệt được.
const SAI_SO = 0.0012;
// Bỏ các đảo/mảnh vụn nhỏ hơn ngưỡng này (độ vuông, ~0.00002 ≈ 25 ha).
const DIEN_TICH_TOI_THIEU = 0.00002;
const SO_LE = 4; // 4 chữ số thập phân ≈ 11 m.

/** Douglas–Peucker: bỏ bớt điểm mà vẫn giữ dáng đường. */
function lamMuot(diem, saiSo) {
  if (diem.length <= 2) return diem;

  let xaNhat = 0;
  let viTri = 0;
  const [x1, y1] = diem[0];
  const [x2, y2] = diem[diem.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chuan = Math.hypot(dx, dy);

  for (let i = 1; i < diem.length - 1; i++) {
    const [x, y] = diem[i];
    const kc =
      chuan === 0
        ? Math.hypot(x - x1, y - y1)
        : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / chuan;
    if (kc > xaNhat) {
      xaNhat = kc;
      viTri = i;
    }
  }

  if (xaNhat <= saiSo) return [diem[0], diem[diem.length - 1]];

  return [
    ...lamMuot(diem.slice(0, viTri + 1), saiSo).slice(0, -1),
    ...lamMuot(diem.slice(viTri), saiSo),
  ];
}

/** Diện tích hình học của một vòng khép kín (công thức shoelace). */
function dienTich(vong) {
  let s = 0;
  for (let i = 0, j = vong.length - 1; i < vong.length; j = i++) {
    s += (vong[j][0] + vong[i][0]) * (vong[j][1] - vong[i][1]);
  }
  return Math.abs(s / 2);
}

const lamTron = (n) => Number(n.toFixed(SO_LE));

/** Làm mượt một vòng, giữ vòng khép kín và tối thiểu 4 điểm. */
function gonVong(vong) {
  let ra = lamMuot(vong, SAI_SO).map(([x, y]) => [lamTron(x), lamTron(y)]);

  // Bỏ điểm trùng nhau sinh ra sau khi làm tròn.
  ra = ra.filter((p, i) => i === 0 || p[0] !== ra[i - 1][0] || p[1] !== ra[i - 1][1]);

  const dau = ra[0];
  const cuoi = ra[ra.length - 1];
  if (dau[0] !== cuoi[0] || dau[1] !== cuoi[1]) ra.push([dau[0], dau[1]]);

  return ra.length >= 4 ? ra : null;
}

/** Gọn một polygon (mảng vòng: vòng 0 là biên ngoài, các vòng sau là lỗ). */
function gonPolygon(polygon) {
  if (dienTich(polygon[0]) < DIEN_TICH_TOI_THIEU) return null;
  const bien = gonVong(polygon[0]);
  if (!bien) return null;
  const lo = polygon.slice(1).map(gonVong).filter(Boolean);
  return [bien, ...lo];
}

const demDiem = (toaDo) => {
  let n = 0;
  const di = (c) => (typeof c[0] === 'number' ? n++ : c.forEach(di));
  di(toaDo);
  return n;
};

// ---------------------------------------------------------------------------

const [, , duongDanVao, duongDanRa = 'public/data/dbscl.geojson'] = process.argv;

if (!duongDanVao) {
  console.error('Thiếu đường dẫn file gốc.');
  console.error('Ví dụ: node scripts/rut-gon-ban-do.mjs vn-34-tinh.geojson');
  process.exit(1);
}

const goc = JSON.parse(readFileSync(duongDanVao, 'utf8'));

const features = [];
let diemTruoc = 0;
let diemSau = 0;

for (const f of goc.features) {
  const ma = String(f.properties.Ma ?? '').padStart(2, '0');
  const ten = TINH_DBSCL[ma];
  if (!ten) continue;

  const polygons =
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

  diemTruoc += demDiem(f.geometry.coordinates);

  const gon = polygons.map(gonPolygon).filter(Boolean);
  if (!gon.length) {
    console.warn(`Bỏ qua ${ten} (${ma}): không còn hình sau khi rút gọn.`);
    continue;
  }

  diemSau += demDiem(gon);

  features.push({
    type: 'Feature',
    // Chỉ giữ mã và tên. Mọi thông tin hiển thị nằm ở src/lib/tinhThanh.ts.
    properties: { ma, ten },
    geometry: { type: 'MultiPolygon', coordinates: gon },
  });
}

const thieu = Object.keys(TINH_DBSCL).filter((ma) => !features.some((f) => f.properties.ma === ma));
if (thieu.length) console.warn(`Không tìm thấy trong file gốc: ${thieu.join(', ')}`);

features.sort((a, b) => a.properties.ten.localeCompare(b.properties.ten, 'vi'));

const ra = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(duongDanRa, ra);

const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(`Gốc: ${goc.features.length} tỉnh, ${diemTruoc.toLocaleString('vi')} điểm ĐBSCL, ${mb(readFileSync(duongDanVao).length)} MB`);
console.log(`Ra:  ${features.length} tỉnh, ${diemSau.toLocaleString('vi')} điểm, ${mb(ra.length)} MB`);
console.log(`→ ${duongDanRa}`);
for (const f of features) console.log(`   ${f.properties.ma}  ${f.properties.ten}`);
