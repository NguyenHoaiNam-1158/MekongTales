-- Lược đồ CSDL cho phần tương tác của Mekong Tales (Cloudflare D1).
--
-- Bài viết vẫn nằm trong git; chỉ những gì người đọc tạo ra mới nằm ở đây.
--
-- Tạo CSDL lần đầu:
--   npx wrangler d1 create mekong-tales
--   (chép database_id vào wrangler.toml)
--   npx wrangler d1 execute mekong-tales --local  --file=db/schema.sql
--   npx wrangler d1 execute mekong-tales --remote --file=db/schema.sql

CREATE TABLE IF NOT EXISTS phan_hoi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bai_slug    TEXT    NOT NULL,
  ten         TEXT    NOT NULL,
  -- Không bắt buộc, không bao giờ trả về cho người đọc. Chỉ quản trị viên thấy.
  email       TEXT,
  noi_dung    TEXT    NOT NULL,
  -- 1..5 sao. NULL nghĩa là chỉ bình luận, không chấm điểm.
  so_sao      INTEGER CHECK (so_sao IS NULL OR so_sao BETWEEN 1 AND 5),
  -- Trả lời một bình luận khác. Chỉ lồng một cấp.
  tra_loi_cho INTEGER REFERENCES phan_hoi(id) ON DELETE CASCADE,
  trang_thai  TEXT    NOT NULL DEFAULT 'cho_duyet'
              CHECK (trang_thai IN ('cho_duyet', 'hien', 'an', 'spam')),
  -- SHA-256 của (địa chỉ IP + muối). KHÔNG lưu IP thô: đủ để chặn spam
  -- mà không giữ dữ liệu định danh người đọc.
  ip_bam      TEXT    NOT NULL,
  tao_luc     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Truy vấn nóng nhất: lấy bình luận đã duyệt của một bài.
CREATE INDEX IF NOT EXISTS idx_phan_hoi_bai
  ON phan_hoi (bai_slug, trang_thai, id);

-- Cho hàng chờ duyệt trong trang quản trị.
CREATE INDEX IF NOT EXISTS idx_phan_hoi_trang_thai
  ON phan_hoi (trang_thai, id DESC);

-- Cho việc đếm số lần gửi gần đây của cùng một người (chống spam).
CREATE INDEX IF NOT EXISTS idx_phan_hoi_ip
  ON phan_hoi (ip_bam, tao_luc);


CREATE TABLE IF NOT EXISTS luot_thich (
  bai_slug TEXT NOT NULL,
  ip_bam   TEXT NOT NULL,
  tao_luc  TEXT NOT NULL DEFAULT (datetime('now')),
  -- Khoá chính chặn luôn việc thích trùng, không cần kiểm tra thêm ở tầng ứng dụng.
  PRIMARY KEY (bai_slug, ip_bam)
);

CREATE INDEX IF NOT EXISTS idx_luot_thich_bai ON luot_thich (bai_slug);


-- ---------------------------------------------------------------------------
-- Thống kê truy cập và chia sẻ
-- ---------------------------------------------------------------------------
--
-- Trang tĩnh được CDN phục vụ thẳng, không chạy qua Functions, nên máy chủ
-- không tự biết có người vào. Trình duyệt phải gửi tín hiệu về /api/su-kien.

CREATE TABLE IF NOT EXISTS luot_xem (
  duong_dan TEXT    NOT NULL,
  -- SHA-256 của IP kèm muối, giống bảng phan_hoi. KHÔNG lưu IP thô.
  ip_bam    TEXT    NOT NULL,
  -- Ngày theo giờ UTC. Gộp theo ngày để đếm được khách duy nhất mà không
  -- phải lưu từng lượt xem riêng lẻ — bảng không phình theo lưu lượng.
  ngay      TEXT    NOT NULL,
  so_lan    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (duong_dan, ip_bam, ngay)
);

CREATE INDEX IF NOT EXISTS idx_luot_xem_ngay ON luot_xem (ngay, duong_dan);


-- Mỗi lần bấm nút chia sẻ là một dòng.
--
-- LƯU Ý: đây KHÔNG phải số lượt chia sẻ thật. Người đọc copy link rồi dán vào
-- Zalo hay tin nhắn thì không có tín hiệu nào quay về. Con số này chỉ nói được
-- bao nhiêu lần người ta bấm nút chia sẻ trên trang.
CREATE TABLE IF NOT EXISTS luot_chia_se (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  duong_dan TEXT NOT NULL,
  -- facebook | x | sao-chep
  kenh      TEXT NOT NULL,
  ip_bam    TEXT NOT NULL,
  tao_luc   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chia_se_duong_dan ON luot_chia_se (duong_dan);
CREATE INDEX IF NOT EXISTS idx_chia_se_tao_luc ON luot_chia_se (tao_luc);
