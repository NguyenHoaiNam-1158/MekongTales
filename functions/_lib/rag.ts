import kho from '../../src/data/kho-tri-thuc.json';
import cacTinh from '../../src/data/tinh-thanh.json';

// Khai tối thiểu thay cho @cloudflare/workers-types, tránh đụng độ với kiểu DOM của Astro.
export interface WorkersAI {
  run(
    model: string,
    input: { text: string[] } | Record<string, unknown>
  ): Promise<{ data?: number[][]; response?: string | number[][] } & Record<string, unknown>>;
}

export interface Doan {
  id: string;
  noi_dung: string;
  tieu_de: string;
  url: string;
  loai: string;
  chuyen_muc: string | null;
  tinh_slug: string | null;
  tac_gia: string | null;
  ngay_dang: string | null;
  tags: string[];
  v: string; // vector int8 mã hoá base64
}

export interface KetQua extends Omit<Doan, 'v'> {
  diem: number;
}

/** Giải nén vector base64 → int8. Chạy một lần lúc nạp module, không lặp mỗi request. */
function giaiNen(b64: string): Int8Array {
  const nhiPhan = atob(b64);
  const ra = new Int8Array(nhiPhan.length);
  // Int8Array tự quy đổi 0..255 về -128..127, không cần xử lý dấu bằng tay.
  for (let i = 0; i < nhiPhan.length; i++) ra[i] = nhiPhan.charCodeAt(i);
  return ra;
}

const DOAN = (kho.doan as unknown as Doan[]).map(({ v, ...meta }) => ({
  ...meta,
  vector: giaiNen(v),
}));

/**
 * Vector trong kho đã chuẩn hoá về độ dài 1 rồi mới lượng tử hoá, nên chỉ cần
 * chuẩn hoá vector câu hỏi là tích vô hướng bằng đúng cosine. Chia 127 để đưa
 * int8 về lại thang [-1, 1].
 */
function chamDiem(cauHoi: Float64Array, doan: Int8Array): number {
  let tich = 0;
  for (let i = 0; i < cauHoi.length; i++) tich += cauHoi[i] * doan[i];
  return tich / 127;
}

function chuanHoa(v: number[]): Float64Array {
  let chuan = 0;
  for (const x of v) chuan += x * x;
  chuan = Math.sqrt(chuan) || 1;

  const ra = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) ra[i] = v[i] / chuan;
  return ra;
}

export async function tinhVectorCauHoi(cauHoi: string, ai: WorkersAI): Promise<number[]> {
  const res = await ai.run(kho.model, { text: [cauHoi] });
  const data = res.data ?? (Array.isArray(res.response) ? res.response : undefined);
  const vector = data?.[0];
  if (!vector) throw new Error('Workers AI khong tra ve vector');
  return vector as number[];
}

/** Bỏ dấu tiếng Việt để so khớp tên tỉnh không phụ thuộc cách gõ. */
const boDau = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

// Tên tỉnh mới lẫn tỉnh cũ đều dẫn về slug tỉnh mới, để bắt được câu hỏi kiểu
// "Mỹ Tho ở Tiền Giang có món gì" khi tư liệu đã gắn nhãn tỉnh Đồng Tháp.
const TU_KHOA_TINH: { tu: string; slug: string }[] = cacTinh.flatMap((t) =>
  [t.ten, ...t.sap_nhap].map((ten) => ({ tu: boDau(ten), slug: t.slug }))
);

/** Các tỉnh được nhắc tới trong câu hỏi. */
export function nhanDienTinh(cauHoi: string): Set<string> {
  const chu = boDau(cauHoi);
  const ra = new Set<string>();
  for (const { tu, slug } of TU_KHOA_TINH) if (chu.includes(tu)) ra.add(slug);
  return ra;
}

// Điểm cộng cho đoạn thuộc đúng tỉnh được hỏi. Đủ để đẩy tư liệu đúng vùng lên
// trước, nhưng không đủ để lấn át một đoạn khác hẳn về nội dung.
const THUONG_DUNG_TINH = 0.08;

export function timDoanLienQuan(vectorCauHoi: number[], cauHoi = '', soLuong = 4, nguong = 0.3): KetQua[] {
  const q = chuanHoa(vectorCauHoi);
  const tinhDuocHoi = nhanDienTinh(cauHoi);

  return DOAN.map(({ vector, ...meta }) => {
    const diem = chamDiem(q, vector);
    const dungTinh = meta.tinh_slug !== null && tinhDuocHoi.has(meta.tinh_slug);
    return { ...meta, diem: dungTinh ? diem + THUONG_DUNG_TINH : diem };
  })
    .filter((d) => d.diem >= nguong)
    .sort((a, b) => b.diem - a.diem)
    .slice(0, soLuong);
}

export function ghepNguQuanh(ketQua: KetQua[]): string {
  return ketQua
    .map((d, i) => {
      const meta = [d.tieu_de, d.tac_gia && `tác giả ${d.tac_gia}`, d.ngay_dang]
        .filter(Boolean)
        .join(' — ');
      return `[Nguồn ${i + 1}] ${meta}\nĐường dẫn: ${d.url}\n\n${d.noi_dung}`;
    })
    .join('\n\n---\n\n');
}

export function gomNguon(ketQua: KetQua[]) {
  const daCo = new Set<string>();
  return ketQua
    .filter((d) => (daCo.has(d.url) ? false : daCo.add(d.url)))
    .map((d) => ({ tieu_de: d.tieu_de, url: d.url, diem: Math.round(d.diem * 100) / 100 }));
}

export const thongTinKho = {
  soDoan: DOAN.length,
  soTrang: new Set(DOAN.map((d) => d.url)).size,
  taoLuc: kho.tao_luc as string | null,
};
