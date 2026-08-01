// Đếm đoạn trong bài viết, để biết đặt khối ảnh vào `sau_doan` số mấy.
//
//   npm run dem-doan                    liệt kê mọi bài kèm số đoạn
//   npm run dem-doan -- <slug hoặc phần tên>   xem từng đoạn của một bài
//
// Vì sao cần: khối ảnh được chèn theo SỐ THỨ TỰ đoạn, mà đếm tay trong ô soạn
// thảo rất dễ nhầm — nhất là khi bài có tiêu đề phụ hay danh sách, những thứ
// cũng được tính là một "đoạn".

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

const THU_MUC = 'src/content/bai-viet';
const tim = process.argv[2];

/** Giống hệt cách tách trong src/lib/thanBai.ts — phải luôn khớp nhau. */
const tachDoan = (md) =>
  md
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((d) => d.trim())
    .filter(Boolean);

const loai = (d) => {
  if (/^#{1,6}\s/.test(d)) return 'tiêu đề';
  if (/^\s*[-*+]\s/.test(d) || /^\s*\d+\.\s/.test(d)) return 'danh sách';
  if (/^>/.test(d)) return 'trích dẫn';
  if (/^-{3,}$/.test(d.trim())) return 'đường kẻ';
  if (/^!?\[/.test(d)) return 'ảnh/liên kết';
  return 'văn';
};

const gonChu = (d, n = 62) => {
  const s = d.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};

const files = (await readdir(THU_MUC)).filter((f) => f.endsWith('.md')).sort();

// ------------------------------------------------- liệt kê toàn bộ bài viết
if (!tim) {
  console.log('\nSố đoạn của từng bài  (dùng cho trường sau_doan của khối ảnh)\n');
  console.log('  đoạn  khối ảnh  bài');
  console.log('  ' + '─'.repeat(72));

  for (const f of files) {
    const { data, content } = matter(await readFile(join(THU_MUC, f), 'utf8'));
    const soDoan = tachDoan(content).length;
    const khoi = data.khoi_anh ?? [];
    const hong = khoi.filter((k) => (k.sau_doan ?? 0) > soDoan);

    console.log(
      `  ${String(soDoan).padStart(4)}  ${String(khoi.length).padStart(7)}  ` +
        f.replace(/\.md$/, '') +
        (data.draft ? '  [nháp]' : '') +
        (hong.length ? `  ⚠ ${hong.length} khối trỏ quá số đoạn` : '')
    );
  }

  console.log('\nXem chi tiết một bài:  npm run dem-doan -- banh-xeo\n');
  process.exit(0);
}

// ------------------------------------------------------- xem chi tiết một bài
const khop = files.filter((f) => f.toLowerCase().includes(tim.toLowerCase()));

if (!khop.length) {
  console.error(`Không tìm thấy bài nào khớp "${tim}".`);
  process.exit(1);
}
if (khop.length > 1) {
  console.error(`"${tim}" khớp nhiều bài, ghi rõ hơn giúp mình:`);
  khop.forEach((f) => console.error('  ' + f.replace(/\.md$/, '')));
  process.exit(1);
}

const { data, content } = matter(await readFile(join(THU_MUC, khop[0]), 'utf8'));
const doan = tachDoan(content);

// Gom khối ảnh theo vị trí để in xen vào đúng chỗ.
const khoiTheoViTri = new Map();
for (const k of data.khoi_anh ?? []) {
  const v = k.sau_doan ?? 0;
  if (!khoiTheoViTri.has(v)) khoiTheoViTri.set(v, []);
  khoiTheoViTri.get(v).push(k);
}

const inKhoi = (v) => {
  for (const k of khoiTheoViTri.get(v) ?? []) {
    const soAnh = (k.anh ?? []).length;
    console.log(
      `        ┌─ KHỐI ẢNH: ${k.kieu} · ${soAnh} ảnh` +
        (k.chu ? ' · có đoạn chữ đi kèm' : '') +
        (k.chu_thich ? `\n        │  “${gonChu(k.chu_thich, 56)}”` : '')
    );
  }
};

console.log(`\n${data.title}`);
console.log(`${doan.length} đoạn · ${(data.khoi_anh ?? []).length} khối ảnh\n`);

inKhoi(0);
doan.forEach((d, i) => {
  const so = i + 1;
  console.log(`  ${String(so).padStart(3)}. [${loai(d).padEnd(11)}] ${gonChu(d)}`);
  inKhoi(so);
});

// Khối trỏ ra ngoài phạm vi sẽ KHÔNG hiện trên trang mà không báo gì.
const hong = [...khoiTheoViTri.keys()].filter((v) => v > doan.length);
if (hong.length) {
  console.log(
    `\n  ⚠ Có khối ảnh đặt ở đoạn ${hong.join(', ')} nhưng bài chỉ có ${doan.length} đoạn.`
  );
  console.log('    Những khối này sẽ KHÔNG hiện trên trang.');
}

console.log('\n  sau_doan: 0 nghĩa là đặt ngay đầu bài, trước đoạn 1.\n');
