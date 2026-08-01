// Dùng chung cho các endpoint phản hồi: kiểu D1, băm IP, kiểm tra Turnstile,
// kiểm tra dữ liệu gửi lên.

// Khai tối thiểu thay cho @cloudflare/workers-types (xem ghi chú trong rag.ts).
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}

export interface EnvPhanHoi {
  DB: D1Database;
  /** Muối để băm IP. Bắt buộc — xem ghi chú ở bamIP(). */
  MUOI_BAM?: string;
  /** Khoá bí mật Turnstile. Bắt buộc. */
  TURNSTILE_KHOA?: string;
  /** Khoá công khai Turnstile. Không bí mật, được gửi xuống trình duyệt. */
  TURNSTILE_SITE_KEY?: string;
  /** Khoá truy cập trang quản trị. Bắt buộc cho /api/quan-tri/*. */
  QUAN_TRI_KHOA?: string;
}

/**
 * Khoá Turnstile thử nghiệm chính thức của Cloudflare: luôn vượt qua kiểm tra.
 *
 * Dùng làm giá trị mặc định để chạy ở máy không phải cấu hình gì. Nhưng khoá
 * công khai và khoá bí mật phải THÀNH CẶP — dùng khoá thử này kèm khoá bí mật
 * thật thì mọi vé đều bị từ chối.
 */
export const KHOA_TURNSTILE_THU = '1x00000000000000000000AA';

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

/**
 * Băm IP kèm muối.
 *
 * Băm IPv4 trần là vô nghĩa: chỉ có 4 tỉ địa chỉ, dò ngược hết bảng băm mất
 * vài phút. Phải có muối bí mật thì giá trị lưu lại mới thật sự ẩn danh.
 * Vì vậy thiếu MUOI_BAM là dừng hẳn, không chạy tiếp với muối rỗng.
 */
export async function bamIP(request: Request, muoi: string | undefined): Promise<string> {
  if (!muoi) throw new Error('Thiếu MUOI_BAM');

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'khong-ro';

  const bytes = new TextEncoder().encode(`${muoi}:${ip}`);
  const bam = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(bam)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** So sánh chuỗi trong thời gian không đổi, tránh lộ khoá qua thời gian phản hồi. */
export function bangNhau(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let khac = 0;
  for (let i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return khac === 0;
}

/** Kiểm tra vé Turnstile với Cloudflare. Sai hoặc thiếu cấu hình đều trả false. */
export async function kiemTraTurnstile(
  ve: unknown,
  khoa: string | undefined,
  ip: string | null
): Promise<boolean> {
  if (!khoa || typeof ve !== 'string' || !ve) return false;

  const form = new FormData();
  form.append('secret', khoa);
  form.append('response', ve);
  if (ip) form.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const kq = (await res.json()) as { success?: boolean };
    return kq.success === true;
  } catch {
    return false;
  }
}

// Slug bài viết do CMS sinh ra luôn có dạng 2025-06-01-ten-bai.
const DANG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DANG_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const GIOI_HAN = {
  ten: { min: 2, max: 60 },
  noi_dung: { min: 2, max: 2000 },
  email: { max: 120 },
  slug: { max: 120 },
} as const;

export interface PhanHoiGuiLen {
  bai_slug: string;
  ten: string;
  email: string | null;
  noi_dung: string;
  so_sao: number | null;
  tra_loi_cho: number | null;
}

/** Kiểm tra dữ liệu người dùng gửi lên. Trả về lỗi đầu tiên gặp phải. */
export function kiemTraPhanHoi(body: Record<string, unknown>): { loi: string } | { du_lieu: PhanHoiGuiLen } {
  const chuoi = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const bai_slug = chuoi(body.bai_slug);
  if (!bai_slug || bai_slug.length > GIOI_HAN.slug.max || !DANG_SLUG.test(bai_slug))
    return { loi: 'Không xác định được bài viết.' };

  const ten = chuoi(body.ten);
  if (ten.length < GIOI_HAN.ten.min || ten.length > GIOI_HAN.ten.max)
    return { loi: `Tên phải từ ${GIOI_HAN.ten.min} đến ${GIOI_HAN.ten.max} ký tự.` };

  const noi_dung = chuoi(body.noi_dung);
  if (noi_dung.length < GIOI_HAN.noi_dung.min)
    return { loi: 'Bạn chưa viết nội dung.' };
  if (noi_dung.length > GIOI_HAN.noi_dung.max)
    return { loi: `Nội dung tối đa ${GIOI_HAN.noi_dung.max} ký tự.` };

  const emailTho = chuoi(body.email);
  if (emailTho && (emailTho.length > GIOI_HAN.email.max || !DANG_EMAIL.test(emailTho)))
    return { loi: 'Email không hợp lệ. Bạn có thể bỏ trống ô này.' };

  let so_sao: number | null = null;
  if (body.so_sao !== null && body.so_sao !== undefined && body.so_sao !== '') {
    so_sao = Number(body.so_sao);
    if (!Number.isInteger(so_sao) || so_sao < 1 || so_sao > 5)
      return { loi: 'Số sao phải từ 1 đến 5.' };
  }

  let tra_loi_cho: number | null = null;
  if (body.tra_loi_cho !== null && body.tra_loi_cho !== undefined && body.tra_loi_cho !== '') {
    tra_loi_cho = Number(body.tra_loi_cho);
    if (!Number.isInteger(tra_loi_cho) || tra_loi_cho < 1)
      return { loi: 'Bình luận được trả lời không hợp lệ.' };
  }

  // Nghị định 13/2023/NĐ-CP: phải có sự đồng ý rõ ràng trước khi thu thập
  // dữ liệu cá nhân. Ô đánh dấu ở form là bằng chứng đồng ý đó.
  if (body.dong_y !== true)
    return { loi: 'Bạn cần đồng ý với chính sách quyền riêng tư trước khi gửi.' };

  return { du_lieu: { bai_slug, ten, email: emailTho || null, noi_dung, so_sao, tra_loi_cho } };
}

/** Số lần gửi tối đa của một người trong khoảng thời gian dưới đây. */
export const CHONG_DOI = { soLan: 5, phut: 10 } as const;

export async function guiQuaNhieu(db: D1Database, ipBam: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM phan_hoi
       WHERE ip_bam = ? AND tao_luc >= datetime('now', ?)`
    )
    .bind(ipBam, `-${CHONG_DOI.phut} minutes`)
    .first<{ n: number }>();

  return (row?.n ?? 0) >= CHONG_DOI.soLan;
}
