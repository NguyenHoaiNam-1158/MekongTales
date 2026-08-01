// Duyệt bình luận.
//
//   GET  /api/quan-tri/phan-hoi?trang_thai=cho_duyet   xem hàng chờ
//   POST /api/quan-tri/phan-hoi   body: { id, trang_thai }
//
// XÁC THỰC TẠM THỜI: khoá bí mật dùng chung qua header Authorization.
// Bước 5 của kế hoạch sẽ thay bằng Cloudflare Access (đăng nhập Google, không
// còn khoá dùng chung để lộ). Khi đó chỉ cần đổi hàm coQuyen() bên dưới thành
// kiểm tra header Cf-Access-Jwt-Assertion.

import { json, bangNhau, type EnvPhanHoi } from '../../_lib/phanHoi';

interface NguCanh {
  request: Request;
  env: EnvPhanHoi;
}

const TRANG_THAI_HOP_LE = ['cho_duyet', 'hien', 'an', 'spam'] as const;
type TrangThai = (typeof TRANG_THAI_HOP_LE)[number];

function coQuyen(request: Request, env: EnvPhanHoi): boolean {
  if (!env.QUAN_TRI_KHOA) return false;
  const header = request.headers.get('Authorization') ?? '';
  const khoa = header.startsWith('Bearer ') ? header.slice(7) : '';
  return khoa.length > 0 && bangNhau(khoa, env.QUAN_TRI_KHOA);
}

const tuChoi = () => json({ loi: 'Không có quyền truy cập.' }, 401);

export const onRequestGet = async ({ request, env }: NguCanh): Promise<Response> => {
  if (!coQuyen(request, env)) return tuChoi();
  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);

  const tham = new URL(request.url).searchParams.get('trang_thai') ?? 'cho_duyet';
  const trangThai = (TRANG_THAI_HOP_LE as readonly string[]).includes(tham)
    ? (tham as TrangThai)
    : 'cho_duyet';

  try {
    const [ds, dem] = await Promise.all([
      env.DB.prepare(
        `SELECT id, bai_slug, ten, email, noi_dung, so_sao, tra_loi_cho, trang_thai, tao_luc
           FROM phan_hoi
          WHERE trang_thai = ?
          ORDER BY id DESC
          LIMIT 100`
      )
        .bind(trangThai)
        .all(),
      env.DB.prepare(
        `SELECT trang_thai, COUNT(*) AS n FROM phan_hoi GROUP BY trang_thai`
      ).all<{ trang_thai: string; n: number }>(),
    ]);

    const thongKe = Object.fromEntries(dem.results.map((r) => [r.trang_thai, r.n]));
    return json({ danh_sach: ds.results, thong_ke: thongKe });
  } catch (e) {
    console.error('quan-tri GET:', e);
    return json({ loi: 'Không tải được danh sách.' }, 500);
  }
};

export const onRequestPost = async ({ request, env }: NguCanh): Promise<Response> => {
  if (!coQuyen(request, env)) return tuChoi();
  if (!env.DB) return json({ loi: 'Máy chủ chưa nối cơ sở dữ liệu.' }, 500);

  let id: number;
  let trangThai: string;
  try {
    const body = (await request.json()) as { id?: unknown; trang_thai?: unknown };
    id = Number(body.id);
    trangThai = String(body.trang_thai ?? '');
  } catch {
    return json({ loi: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  if (!Number.isInteger(id) || id < 1) return json({ loi: 'Thiếu mã bình luận.' }, 400);
  if (!(TRANG_THAI_HOP_LE as readonly string[]).includes(trangThai))
    return json({ loi: 'Trạng thái không hợp lệ.' }, 400);

  try {
    const co = await env.DB.prepare(`SELECT id FROM phan_hoi WHERE id = ?`).bind(id).first();
    if (!co) return json({ loi: 'Không tìm thấy bình luận.' }, 404);

    await env.DB.prepare(`UPDATE phan_hoi SET trang_thai = ? WHERE id = ?`)
      .bind(trangThai, id)
      .run();

    // Ẩn bình luận gốc thì các trả lời của nó cũng phải ẩn theo, nếu không
    // người đọc sẽ thấy câu trả lời lơ lửng không rõ đang nói với ai.
    if (trangThai !== 'hien') {
      await env.DB.prepare(
        `UPDATE phan_hoi SET trang_thai = ? WHERE tra_loi_cho = ? AND trang_thai = 'hien'`
      )
        .bind(trangThai, id)
        .run();
    }

    return json({ ok: true, id, trang_thai: trangThai });
  } catch (e) {
    console.error('quan-tri POST:', e);
    return json({ loi: 'Chưa cập nhật được.' }, 500);
  }
};
