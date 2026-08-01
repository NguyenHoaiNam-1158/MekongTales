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
