// Số liệu truy cập và chia sẻ cho trang /quan-tri.
//
//   GET /api/quan-tri/thong-ke
//
// Xác thực dùng chung cơ chế với /api/quan-tri/phan-hoi (xem ghi chú ở đó).

import { json, bangNhau, type EnvPhanHoi } from '../../_lib/phanHoi';

interface NguCanh {
  request: Request;
  env: EnvPhanHoi;
}

function coQuyen(request: Request, env: EnvPhanHoi): boolean {
  if (!env.QUAN_TRI_KHOA) return false;
  const header = request.headers.get('Authorization') ?? '';
  const khoa = header.startsWith('Bearer ') ? header.slice(7) : '';
  return khoa.length > 0 && bangNhau(khoa, env.QUAN_TRI_KHOA);
}

/** Khách duy nhất và tổng lượt xem trong N ngày gần đây. */
const CAU_TONG = `
  SELECT COUNT(DISTINCT ip_bam) AS khach, COALESCE(SUM(so_lan), 0) AS luot
    FROM luot_xem
   WHERE ngay >= date('now', ?)`;

export const onRequestGet = async ({ request, env }: NguCanh): Promise<Response> => {
  if (!coQuyen(request, env)) return json({ loi: 'Không có quyền truy cập.' }, 401);
  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);

  try {
    const [homNay, bayNgay, baMuoiNgay, tatCa, theoNgay, topTrang, chiaSe, kenh] =
      await Promise.all([
        env.DB.prepare(CAU_TONG).bind('-0 day').first<{ khach: number; luot: number }>(),
        env.DB.prepare(CAU_TONG).bind('-6 day').first<{ khach: number; luot: number }>(),
        env.DB.prepare(CAU_TONG).bind('-29 day').first<{ khach: number; luot: number }>(),
        env.DB.prepare(
          `SELECT COUNT(DISTINCT ip_bam) AS khach, COALESCE(SUM(so_lan), 0) AS luot FROM luot_xem`
        ).first<{ khach: number; luot: number }>(),

        // Biểu đồ 14 ngày gần nhất.
        env.DB.prepare(
          `SELECT ngay, COUNT(DISTINCT ip_bam) AS khach, SUM(so_lan) AS luot
             FROM luot_xem
            WHERE ngay >= date('now', '-13 day')
            GROUP BY ngay
            ORDER BY ngay`
        ).all<{ ngay: string; khach: number; luot: number }>(),

        env.DB.prepare(
          `SELECT duong_dan,
                  COUNT(DISTINCT ip_bam) AS khach,
                  SUM(so_lan) AS luot
             FROM luot_xem
            GROUP BY duong_dan
            ORDER BY luot DESC
            LIMIT 15`
        ).all<{ duong_dan: string; khach: number; luot: number }>(),

        env.DB.prepare(
          `SELECT duong_dan, COUNT(*) AS so_lan
             FROM luot_chia_se
            GROUP BY duong_dan
            ORDER BY so_lan DESC
            LIMIT 15`
        ).all<{ duong_dan: string; so_lan: number }>(),

        env.DB.prepare(
          `SELECT kenh, COUNT(*) AS so_lan FROM luot_chia_se GROUP BY kenh ORDER BY so_lan DESC`
        ).all<{ kenh: string; so_lan: number }>(),
      ]);

    return json({
      truy_cap: {
        hom_nay: homNay,
        bay_ngay: bayNgay,
        ba_muoi_ngay: baMuoiNgay,
        tat_ca: tatCa,
      },
      theo_ngay: theoNgay.results,
      top_trang: topTrang.results,
      chia_se: {
        theo_trang: chiaSe.results,
        theo_kenh: kenh.results,
        tong: kenh.results.reduce((s, k) => s + k.so_lan, 0),
      },
    });
  } catch (e) {
    console.error('thong-ke:', e);
    return json({ loi: 'Không tải được số liệu.' }, 500);
  }
};
