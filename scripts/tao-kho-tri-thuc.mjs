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

    const doan = catDoan(than);
    doan.forEach((noiDung, i) => {
      mau.push({
        id: `${slug}#${i}`,
        noi_dung: noiDung,
        tieu_de: data.title ?? slug,
        url: url(slug),
        loai,
        chuyen_muc: data.chuyen_muc ?? null,
        tac_gia: data.tac_gia ?? null,
        ngay_dang: chuanHoaNgay(data.ngay_dang),
        tags: data.tags ?? [],
      });
    });
    console.log(`  ${file}: ${doan.length} doan`);
  }
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

const lamTron = (v) => v.map((x) => Math.round(x * 10000) / 10000);

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
    tao_luc: new Date().toISOString(),
    doan: mau.map((m, i) => ({ ...m, vector: lamTron(vectors[i]) })),
  };

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/kho-tri-thuc.json', JSON.stringify(kho));

  const kb = Math.round(JSON.stringify(kho).length / 1024);
  console.log(`\nDa ghi src/data/kho-tri-thuc.json — ${mau.length} doan, ${kho.so_chieu} chieu, ${kb} KB`);
  if (kb > 700) console.warn('CANH BAO: file lon, sap cham gioi han 1 MB cua Worker. Can chuyen sang Vectorize.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
