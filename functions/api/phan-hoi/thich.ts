// Bật/tắt lượt thích cho một bài viết.
//
//   POST /api/phan-hoi/thich   body: { bai_slug }
//
// Không cần Turnstile: khoá chính (bai_slug, ip_bam) đã chặn thích trùng, và
// thao tác này không sinh ra nội dung nào để phải kiểm duyệt.

import { json, bamIP, type EnvPhanHoi } from '../../_lib/phanHoi';

interface NguCanh {
  request: Request;
  env: EnvPhanHoi;
}

const DANG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const onRequestPost = async ({ request, env }: NguCanh): Promise<Response> => {
  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);
  if (!env.MUOI_BAM) {
    console.error('thich: thieu MUOI_BAM');
    return json({ loi: 'Máy chủ chưa được cấu hình đầy đủ.' }, 500);
  }

  let bai = '';
  try {
    const body = (await request.json()) as { bai_slug?: unknown };
    bai = typeof body.bai_slug === 'string' ? body.bai_slug.trim() : '';
  } catch {
    return json({ loi: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  if (!bai || bai.length > 120 || !DANG_SLUG.test(bai))
    return json({ loi: 'Không xác định được bài viết.' }, 400);

  try {
    const ipBam = await bamIP(request, env.MUOI_BAM);

    const daCo = await env.DB.prepare(
      `SELECT 1 FROM luot_thich WHERE bai_slug = ? AND ip_bam = ?`
    )
      .bind(bai, ipBam)
      .first();

    if (daCo) {
      await env.DB.prepare(`DELETE FROM luot_thich WHERE bai_slug = ? AND ip_bam = ?`)
        .bind(bai, ipBam)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO luot_thich (bai_slug, ip_bam) VALUES (?, ?)`
      )
        .bind(bai, ipBam)
        .run();
    }

    const dem = await env.DB.prepare(`SELECT COUNT(*) AS n FROM luot_thich WHERE bai_slug = ?`)
      .bind(bai)
      .first<{ n: number }>();

    return json({ so_thich: dem?.n ?? 0, da_thich: !daCo });
  } catch (e) {
    console.error('thich:', e);
    return json({ loi: 'Chưa ghi nhận được, bạn thử lại sau.' }, 500);
  }
};
