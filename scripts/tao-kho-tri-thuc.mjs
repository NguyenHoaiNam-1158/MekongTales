import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

const MODEL = '@cf/baai/bge-m3';
const CO_CHU = 1000;
const CHONG_LAN = 150;
const LO = 50;

const NGUON = [
  { thuMuc: 'src/content/bai-viet', loai: 'bai-viet', url: (s) => `/bai-viet/${s}` },
  { thuMuc: 'src/content/podcast', loai: 'podcast', url: () => '/podcast' },
  { thuMuc: 'src/content/phong-su', loai: 'phong-su', url: () => '/phong-su' },
];

const CAC_TINH = JSON.parse(await readFile('src/data/tinh-thanh.json', 'utf8'));

/** Đưa slug tỉnh cũ (trước sáp nhập 2025) về slug tỉnh mới. */
function chuanHoaTinh(slug) {
  if (!slug) return null;
  const tinh = CAC_TINH.find((t) => t.slug === slug || t.slug_cu.includes(slug));
  return tinh?.slug ?? null;
}

function catDoan(text) {
  const doanVan = text.split(/\n\s*\n/).map((d) => d.trim()).filter(Boolean);
  const ketQua = [];
  let hienTai = '';

  for (const doan of doanVan) {
    if (hienTai.length + doan.length + 2 > CO_CHU && hienTai) {
      ketQua.push(hienTai);
      // Giữ phần đuôi làm chồng lấn để câu không bị cắt mất ngữ cảnh
      hienTai = hienTai.slice(-CHONG_LAN) + '\n\n' + doan;
    } else {
      hienTai = hienTai ? hienTai + '\n\n' + doan : doan;
    }
  }
  if (hienTai.trim()) ketQua.push(hienTai);
  return ketQua;
}

function chuanHoaNgay(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

function lamSach(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function docThuMuc({ thuMuc, loai, url }) {
  let files;
  try {
    files = (await readdir(thuMuc)).filter((f) => f.endsWith('.md'));
  } catch {
    console.warn(`  bo qua ${thuMuc} (khong ton tai)`);
    return [];
  }

  const mau = [];
  for (const file of files) {
    const raw = await readFile(join(thuMuc, file), 'utf-8');
    const { data, content } = matter(raw);

    if (data.draft === true) {
      console.log(`  bo qua ban nhap: ${file}`);
      continue;
    }

    const slug = file.replace(/\.md$/, '');
    // Gop cac doan chu chay canh anh (khoi_anh[].chu) vao than bai
    const chuKhoiAnh = Array.isArray(data.khoi_anh)
      ? data.khoi_anh.map((k) => k.chu).filter(Boolean).join('\n\n')
      : '';
    const thanGoc = [content, chuKhoiAnh].filter(Boolean).join('\n\n');
    // Podcast/phong su thuong chua co than bai — dung mo_ta de van tim duoc
    const than = lamSach(thanGoc) || lamSach(data.mo_ta ?? '');
    if (!than) {
      console.warn(`  ${file}: khong co noi dung lan mo_ta, bo qua`);
      continue;
    }

    const tinhSlug = chuanHoaTinh(data.dia_diem?.tinh_slug);
    if (data.dia_diem?.tinh_slug && !tinhSlug) {
      console.warn(`  ${file}: tinh_slug="${data.dia_diem.tinh_slug}" khong khop tinh nao`);
    }

    const doan = catDoan(than);
    doan.forEach((noiDung, i) => {
      mau.push({
        id: `${slug}#${i}`,
        noi_dung: noiDung,
        tieu_de: data.title ?? slug,
        url: url(slug),
        loai,
        chuyen_muc: data.chuyen_muc ?? null,
        tinh_slug: tinhSlug,
        tac_gia: data.tac_gia ?? null,
        ngay_dang: chuanHoaNgay(data.ngay_dang),
        tags: data.tags ?? [],
      });
    });
    console.log(`  ${file}: ${doan.length} doan${tinhSlug ? ` (${tinhSlug})` : ''}`);
  }
  return mau;
}

/**
 * Tu lieu tra cuu ve 5 tinh thanh ĐBSCL sau sap nhap 2025.
 *
 * Bai viet trong kho van goi ten tinh CU (Tien Giang, Ben Tre...) nen neu thieu
 * phan nay, tro ly se tra loi dia gioi loi thoi. Sinh tu src/data/tinh-thanh.json
 * de khong phai chep tay.
 */
function tuLieuTinhThanh() {
  const mau = [];

  const doiChieu = CAC_TINH.map(
    (t) => `- Tỉnh ${t.ten} hiện nay gồm các tỉnh cũ: ${t.sap_nhap.join(', ')}.`
  ).join('\n');

  mau.push({
    id: 'tinh-thanh#doi-chieu',
    noi_dung:
      'Đối chiếu địa giới hành chính miền Tây Nam Bộ trước và sau sáp nhập năm 2025.\n\n' +
      'Từ ngày 1 tháng 7 năm 2025, cả nước còn 34 tỉnh thành. Vùng Đồng bằng sông Cửu Long ' +
      `từ 13 tỉnh thành cũ nay còn ${CAC_TINH.length} tỉnh thành:\n\n${doiChieu}\n\n` +
      'Riêng tỉnh Long An không còn thuộc Đồng bằng sông Cửu Long mà đã sáp nhập vào tỉnh Tây Ninh.\n\n' +
      'Các bài viết trên trang có thể vẫn gọi theo tên tỉnh cũ tại thời điểm ghi chép.',
    tieu_de: 'Đối chiếu tỉnh thành miền Tây trước và sau sáp nhập 2025',
    url: '/ban-do',
    loai: 'tinh-thanh',
    chuyen_muc: null,
    tinh_slug: null,
    tac_gia: null,
    ngay_dang: '2025-07-01',
    tags: ['sáp nhập', 'địa giới', 'tỉnh thành'],
  });

  for (const t of CAC_TINH) {
    mau.push({
      id: `tinh-thanh#${t.slug}`,
      noi_dung:
        `Tỉnh ${t.ten} (địa giới sau sáp nhập năm 2025).\n\n` +
        `Tỉnh ${t.ten} hiện nay được lập từ các tỉnh cũ: ${t.sap_nhap.join(', ')}.\n\n` +
        `${t.gioi_thieu}\n\n` +
        `Đặc sản tiêu biểu của ${t.ten}: ${t.dac_san.join(', ')}.\n\n` +
        `Di tích và điểm đến tiêu biểu của ${t.ten}: ${t.di_tich.join(', ')}.`,
      tieu_de: `Tỉnh ${t.ten} — đặc sản và di tích`,
      url: '/ban-do',
      loai: 'tinh-thanh',
      chuyen_muc: null,
      tinh_slug: t.slug,
      tac_gia: null,
      ngay_dang: '2025-07-01',
      tags: [t.ten, ...t.sap_nhap],
    });
  }

  console.log(`  tinh-thanh: ${mau.length} doan`);
  return mau;
}

async function tinhVector(danhSachChu, accountId, token) {
  const vectors = [];
  for (let i = 0; i < danhSachChu.length; i += LO) {
    const lo = danhSachChu.slice(i, i + LO);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lo }),
      }
    );

    if (!res.ok) {
      throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const data = json?.result?.data ?? json?.result?.response;
    if (!Array.isArray(data)) {
      throw new Error(`Khong doc duoc vector. Phan hoi: ${JSON.stringify(json).slice(0, 400)}`);
    }

    vectors.push(...data);
    console.log(`  vector ${Math.min(i + LO, danhSachChu.length)}/${danhSachChu.length}`);
  }
  return vectors;
}

/**
 * Nen vector: chuan hoa ve do dai 1 roi luong tu hoa xuong int8, ghi bang base64.
 *
 * 1024 so thuc viet ra JSON ton ~7 KB moi doan; cach nay chi ton ~1,4 KB, tuc
 * ca kho nho di khoang 3,5 lan. Vi vector da chuan hoa nen cosine chinh la tich
 * vo huong, khong can chia lai chuan luc chay.
 *
 * Sai so kiem chung tren kho hien tai: diem lech toi da 0,0085 — chi doi thu tu
 * o nhung cap doan gan nhu hoa diem.
 */
function nenVector(v) {
  let chuan = 0;
  for (const x of v) chuan += x * x;
  chuan = Math.sqrt(chuan) || 1;

  const byte = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) {
    byte[i] = Math.max(-127, Math.min(127, Math.round((v[i] / chuan) * 127)));
  }
  return Buffer.from(byte.buffer).toString('base64');
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const chiCat = process.argv.includes('--chi-cat');

  if (!chiCat && (!accountId || !token)) {
    console.error('Thieu CLOUDFLARE_ACCOUNT_ID hoac CLOUDFLARE_API_TOKEN.');
    console.error('Dung --chi-cat de xem truoc phan doan ma khong goi API.');
    process.exit(1);
  }

  console.log('Doc noi dung:');
  let mau = [];
  for (const nguon of NGUON) mau = mau.concat(await docThuMuc(nguon));
  mau = mau.concat(tuLieuTinhThanh());

  if (!mau.length) {
    console.error('Khong tim thay noi dung nao.');
    process.exit(1);
  }
  console.log(`Tong: ${mau.length} doan tu ${new Set(mau.map((m) => m.url)).size} trang\n`);

  if (chiCat) {
    const soLuong = process.argv.includes('--tat-ca') ? mau.length : 2;
    console.log(JSON.stringify(mau.slice(0, soLuong)));
    return;
  }

  console.log('Tinh vector:');
  const vectors = await tinhVector(mau.map((m) => m.noi_dung), accountId, token);

  const kho = {
    model: MODEL,
    so_chieu: vectors[0].length,
    nen: 'int8-base64',
    tao_luc: new Date().toISOString(),
    doan: mau.map((m, i) => ({ ...m, v: nenVector(vectors[i]) })),
  };

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/kho-tri-thuc.json', JSON.stringify(kho));

  const kb = Math.round(JSON.stringify(kho).length / 1024);
  console.log(`\nDa ghi src/data/kho-tri-thuc.json — ${mau.length} doan, ${kho.so_chieu} chieu, ${kb} KB`);
  if (kb > 900) {
    console.warn('CANH BAO: kho da lon, den luc chuyen sang Cloudflare Vectorize.');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
