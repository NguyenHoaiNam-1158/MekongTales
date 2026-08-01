// Ghi nhận lượt xem trang và lượt bấm nút chia sẻ.
//
//   POST /api/su-kien   body: { loai: 'xem' }
//                             { loai: 'chia_se', kenh: 'facebook' | 'x' | 'sao-chep' }
//
// Đường dẫn lấy từ header Referer chứ không tin vào dữ liệu gửi lên, để không
// ai bơm được số liệu cho một trang tuỳ ý.

import { json, bamIP, type EnvPhanHoi } from '../_lib/phanHoi';

interface NguCanh {
  request: Request & {
    // Cloudflare gắn thêm dữ liệu về request. botManagement có thể không có
    // tuỳ gói dịch vụ nên chỗ nào dùng cũng phải phòng trường hợp thiếu.
    cf?: { botManagement?: { score?: number; verifiedBot?: boolean } };
  };
  env: EnvPhanHoi;
}

const KENH_HOP_LE = ['facebook', 'x', 'sao-chep'] as const;

// Điểm bot của Cloudflare: 1 gần như chắc chắn là máy, 99 gần như chắc chắn là
// người. Dưới ngưỡng này thì không tính vào thống kê.
const NGUONG_BOT = 30;

const DAI_TOI_DA = 200;

/**
 * Chỉ nhận đường dẫn của chính trang này, và bỏ mọi tham số truy vấn.
 * Trả về null nếu không hợp lệ.
 */
function locDuongDan(referer: string | null, goc: string): string | null {
  if (!referer) return null;

  let u: URL;
  try {
    u = new URL(referer);
  } catch {
    return null;
  }

  if (u.origin !== goc) return null;

  // Bỏ query và hash: /bai-viet/abc/?fbclid=... và /bai-viet/abc/ là một trang.
  let duong = u.pathname;
  if (duong.length > DAI_TOI_DA) return null;

  // Chuẩn hoá: luôn có dấu / ở cuối, trừ trang chủ.
  if (duong !== '/' && !duong.endsWith('/')) duong += '/';

  // Trang nội bộ không tính vào thống kê.
  if (duong.startsWith('/quan-tri') || duong.startsWith('/admin')) return null;

  return duong;
}

export const onRequestPost = async ({ request, env }: NguCanh): Promise<Response> => {
  // Thống kê hỏng không được làm ảnh hưởng người đọc, nên mọi trường hợp đều
  // trả 204 và im lặng. Trình duyệt không cần biết kết quả.
  const im = () => new Response(null, { status: 204 });

  if (!env.DB || !env.MUOI_BAM) return im();

  const bot = request.cf?.botManagement;
  if (bot?.verifiedBot === true) return im();
  if (typeof bot?.score === 'number' && bot.score < NGUONG_BOT) return im();

  const duongDan = locDuongDan(request.headers.get('Referer'), new URL(request.url).origin);
  if (!duongDan) return im();

  let loai = '';
  let kenh = '';
  try {
    const body = (await request.json()) as { loai?: unknown; kenh?: unknown };
    loai = typeof body.loai === 'string' ? body.loai : '';
    kenh = typeof body.kenh === 'string' ? body.kenh : '';
  } catch {
    return im();
  }

  try {
    const ipBam = await bamIP(request, env.MUOI_BAM);

    if (loai === 'xem') {
      // Một người xem lại cùng trang trong ngày chỉ làm tăng so_lan, không
      // sinh dòng mới — bảng không phình theo lưu lượng.
      await env.DB.prepare(
        `INSERT INTO luot_xem (duong_dan, ip_bam, ngay, so_lan)
         VALUES (?, ?, date('now'), 1)
         ON CONFLICT (duong_dan, ip_bam, ngay)
         DO UPDATE SET so_lan = so_lan + 1`
      )
        .bind(duongDan, ipBam)
        .run();
      return im();
    }

    if (loai === 'chia_se' && (KENH_HOP_LE as readonly string[]).includes(kenh)) {
      await env.DB.prepare(
        `INSERT INTO luot_chia_se (duong_dan, kenh, ip_bam) VALUES (?, ?, ?)`
      )
        .bind(duongDan, kenh, ipBam)
        .run();
      return im();
    }
  } catch (e) {
    console.error('su-kien:', e);
  }

  return im();
};
