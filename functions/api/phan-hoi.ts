// Bình luận và đánh giá sao dưới mỗi bài viết.
//
//   GET  /api/phan-hoi?bai=<slug>   danh sách đã duyệt + điểm trung bình + lượt thích
//   POST /api/phan-hoi              gửi bình luận mới (vào hàng chờ duyệt)

import {
  json,
  bamIP,
  kiemTraTurnstile,
  kiemTraPhanHoi,
  guiQuaNhieu,
  CHONG_DOI,
  KHOA_TURNSTILE_THU,
  type EnvPhanHoi,
} from '../_lib/phanHoi';

interface NguCanh {
  request: Request;
  env: EnvPhanHoi;
}

interface HangPhanHoi {
  id: number;
  ten: string;
  noi_dung: string;
  so_sao: number | null;
  tra_loi_cho: number | null;
  tao_luc: string;
}

const DANG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const onRequestGet = async ({ request, env }: NguCanh): Promise<Response> => {
  const bai = new URL(request.url).searchParams.get('bai') ?? '';
  if (!bai || !DANG_SLUG.test(bai)) return json({ loi: 'Thiếu mã bài viết.' }, 400);

  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);

  try {
    // Cột email cố tình không nằm trong SELECT: người đọc không bao giờ thấy nó.
    const dsQuery = env.DB.prepare(
      `SELECT id, ten, noi_dung, so_sao, tra_loi_cho, tao_luc
         FROM phan_hoi
        WHERE bai_slug = ? AND trang_thai = 'hien'
        ORDER BY id ASC
        LIMIT 200`
    ).bind(bai);

    const diemQuery = env.DB.prepare(
      `SELECT COUNT(so_sao) AS so_danh_gia, AVG(so_sao) AS diem_tb
         FROM phan_hoi
        WHERE bai_slug = ? AND trang_thai = 'hien' AND so_sao IS NOT NULL`
    ).bind(bai);

    const thichQuery = env.DB.prepare(
      `SELECT COUNT(*) AS n FROM luot_thich WHERE bai_slug = ?`
    ).bind(bai);

    const [ds, diem, thich] = await Promise.all([
      dsQuery.all<HangPhanHoi>(),
      diemQuery.first<{ so_danh_gia: number; diem_tb: number | null }>(),
      thichQuery.first<{ n: number }>(),
    ]);

    // Người đang xem đã bấm thích bài này chưa.
    let daThich = false;
    try {
      const ipBam = await bamIP(request, env.MUOI_BAM);
      const co = await env.DB.prepare(
        `SELECT 1 FROM luot_thich WHERE bai_slug = ? AND ip_bam = ?`
      )
        .bind(bai, ipBam)
        .first();
      daThich = co !== null;
    } catch {
      // Thiếu MUOI_BAM thì vẫn trả được danh sách, chỉ không biết đã thích hay chưa.
    }

    return json({
      danh_sach: ds.results,
      tong: ds.results.length,
      so_danh_gia: diem?.so_danh_gia ?? 0,
      diem_tb: diem?.diem_tb ? Math.round(diem.diem_tb * 10) / 10 : null,
      so_thich: thich?.n ?? 0,
      da_thich: daThich,
      // Gửi kèm khoá công khai Turnstile để trình duyệt tự dựng widget.
      //
      // Trước đây khoá này được nhúng sẵn vào HTML lúc build, nhưng biến lúc
      // build và biến lúc chạy trên Cloudflare Pages là hai chỗ khác nhau, rất
      // dễ đặt nhầm mà không có dấu hiệu gì. Đưa về đây thì chỉ còn một chỗ để
      // cấu hình, và đổi khoá không cần build lại trang.
      turnstile_site_key: env.TURNSTILE_SITE_KEY || KHOA_TURNSTILE_THU,
    });
  } catch (e) {
    console.error('phan-hoi GET:', e);
    return json({ loi: 'Không tải được bình luận.' }, 500);
  }
};

export const onRequestPost = async ({ request, env }: NguCanh): Promise<Response> => {
  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);
  if (!env.MUOI_BAM) {
    console.error('phan-hoi POST: thieu MUOI_BAM');
    return json({ loi: 'Máy chủ chưa được cấu hình đầy đủ.' }, 500);
  }
  if (!env.TURNSTILE_KHOA) {
    console.error('phan-hoi POST: thieu TURNSTILE_KHOA');
    return json({ loi: 'Máy chủ chưa được cấu hình đầy đủ.' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ loi: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  const kq = kiemTraPhanHoi(body);
  if ('loi' in kq) return json({ loi: kq.loi }, 400);
  const d = kq.du_lieu;

  const hopLe = await kiemTraTurnstile(
    body.turnstile,
    env.TURNSTILE_KHOA,
    request.headers.get('CF-Connecting-IP')
  );
  if (!hopLe) return json({ loi: 'Xác minh chống spam không thành công. Bạn thử lại giúp mình.' }, 403);

  try {
    const ipBam = await bamIP(request, env.MUOI_BAM);

    if (await guiQuaNhieu(env.DB, ipBam))
      return json(
        { loi: `Bạn gửi hơi nhanh. Mỗi ${CHONG_DOI.phut} phút chỉ gửi được ${CHONG_DOI.soLan} lần.` },
        429
      );

    // Chỉ cho trả lời bình luận đã hiện của CÙNG bài — chặn việc gán bừa id
    // để moi ra bình luận đang chờ duyệt ở bài khác.
    if (d.tra_loi_cho !== null) {
      const cha = await env.DB.prepare(
        `SELECT id FROM phan_hoi
          WHERE id = ? AND bai_slug = ? AND trang_thai = 'hien' AND tra_loi_cho IS NULL`
      )
        .bind(d.tra_loi_cho, d.bai_slug)
        .first();
      if (!cha) return json({ loi: 'Bình luận bạn muốn trả lời không còn nữa.' }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO phan_hoi (bai_slug, ten, email, noi_dung, so_sao, tra_loi_cho, ip_bam)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(d.bai_slug, d.ten, d.email, d.noi_dung, d.so_sao, d.tra_loi_cho, ipBam)
      .run();

    return json({
      ok: true,
      thong_bao: 'Cảm ơn bạn. Ý kiến sẽ hiện sau khi ban biên tập duyệt.',
    });
  } catch (e) {
    console.error('phan-hoi POST:', e);
    return json({ loi: 'Chưa gửi được, bạn thử lại sau ít phút.' }, 500);
  }
};
