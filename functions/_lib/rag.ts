import kho from '../../src/data/kho-tri-thuc.json';

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
  tac_gia: string | null;
  ngay_dang: string | null;
  tags: string[];
  vector: number[];
}

export interface KetQua extends Doan {
  diem: number;
}

const DOAN = kho.doan as unknown as Doan[];

function cosine(a: number[], b: number[]): number {
  let tich = 0;
  let chuanA = 0;
  let chuanB = 0;
  for (let i = 0; i < a.length; i++) {
    tich += a[i] * b[i];
    chuanA += a[i] * a[i];
    chuanB += b[i] * b[i];
  }
  const mau = Math.sqrt(chuanA) * Math.sqrt(chuanB);
  return mau === 0 ? 0 : tich / mau;
}

export async function tinhVectorCauHoi(cauHoi: string, ai: WorkersAI): Promise<number[]> {
  const res = await ai.run(kho.model, { text: [cauHoi] });
  const data = res.data ?? (Array.isArray(res.response) ? res.response : undefined);
  const vector = data?.[0];
  if (!vector) throw new Error('Workers AI khong tra ve vector');
  return vector as number[];
}

export function timDoanLienQuan(vectorCauHoi: number[], soLuong = 4, nguong = 0.3): KetQua[] {
  return DOAN.map((d) => ({ ...d, diem: cosine(vectorCauHoi, d.vector) }))
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