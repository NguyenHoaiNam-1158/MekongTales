# Mekong Tales

Website nội dung về di sản văn hoá vùng sông Tiền — miền Tây Nam Bộ.
Dựng bằng [Astro](https://astro.build), nội dung viết bằng Markdown, ảnh lưu trên Cloudinary.

---

## 1. Chạy dự án lần đầu

Cần **Node.js phiên bản 22.12 trở lên**. Kiểm tra bằng `node -v`.
Nếu thấp hơn, tải bản LTS mới nhất tại https://nodejs.org

```bash
git clone https://github.com/NguyenHoaiNam-1158/mekong-tales.git
cd mekong-tales

npm install      # tải thư viện, khoảng 1 phút
npx astro sync   # sinh type cho astro:content — BẮT BUỘC sau khi clone
npm run dev      # mở http://localhost:4321
```

**Bỏ qua `npx astro sync` thì VS Code sẽ gạch đỏ dòng `import ... from 'astro:content'`.**
Đó không phải lỗi code, chỉ là type chưa được sinh. Chạy lệnh đó là hết.

### Các lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy máy chủ xem thử, tự tải lại khi sửa file |
| `npm run build` | Dựng site thật vào thư mục `dist/` |
| `npm run preview` | Xem thử thư mục `dist/` sau khi build |
| `npx astro sync` | Sinh lại type khi sửa `content.config.ts` |

---

## 2. Cấu trúc thư mục

```
src/
├── content/              ← NỘI DUNG. Thêm bài = thêm file ở đây
│   ├── bai-viet/         ← Bài viết (.md)
│   ├── podcast/          ← Tập podcast (.md)
│   ├── phong-su/         ← Phóng sự (.md)
│   ├── thanh-vien/       ← Hồ sơ thành viên & giảng viên (.md)
│   └── cai-dat/chung.yml ← Thông tin chung
│
├── content.config.ts     ← Schema. Quy định bài viết BẮT BUỘC có trường nào
├── lib/
│   ├── chuyenMuc.ts      ← Nguồn duy nhất cho tên & mô tả 4 chuyên mục
│   └── img.ts            ← Hàm tối ưu ảnh Cloudinary
├── layouts/              ← Khung trang dùng lại
├── components/           ← Header, Footer, thẻ bài viết...
├── pages/                ← Mỗi file = một đường dẫn trên web
└── styles/global.css     ← Màu, font, bề rộng site

public/admin/             ← Sveltia CMS (trang quản trị đăng bài)
```

### Bản đồ đường dẫn

| Đường dẫn | File sinh ra nó |
|---|---|
| `/` | `pages/index.astro` |
| `/ki-uc`, `/am-thuc`, `/lang-nghe` | `pages/[chuyenMuc]/index.astro` |
| `/lich-su` | `pages/lich-su.astro` (trang riêng, không dùng template chung) |
| `/podcast` | `pages/podcast/index.astro` |
| `/phong-su` | `pages/phong-su/index.astro` |
| `/bai-viet/<tên-file>` | `pages/bai-viet/[...slug].astro` |
| `/about_us` | `pages/about_us.astro` |
| Trang 404 | `pages/404.astro` |

---

## 3. Đăng bài mới

**Không cần sửa code.** Chỉ thêm một file `.md` vào `src/content/bai-viet/`.

Tên file theo mẫu `YYYY-MM-DD-ten-bai.md`, dùng **gạch ngang**, không dấu, không khoảng trắng.
Tên file chính là đường dẫn: `2025-08-01-tranh-kieng.md` → `/bai-viet/2025-08-01-tranh-kieng`

```markdown
---
title: 'Tiêu đề bài viết'
mo_ta: 'Một hai câu tóm tắt. Tối đa 200 ký tự, nên giữ dưới 160.'
anh_bia: 'https://res.cloudinary.com/doljk7ymy/image/upload/v123/ten-anh.jpg'
anh_bia_alt: 'Mô tả ảnh cho người khiếm thị và cho Google'
chuyen_muc: 'lang-nghe'
tags: ['thủ công', 'An Giang']
tac_gia: 'Tên người viết'
ngay_dang: 2025-08-01
noi_bat: false
draft: false
---

Nội dung bài viết viết ở đây.
```

### Những chỗ dễ sai

- **`chuyen_muc` chỉ nhận đúng 4 giá trị:** `ki-uc`, `am-thuc`, `lang-nghe`, `lich-su`.
  Gõ sai một ký tự là build báo lỗi ngay, không lên web được. Đây là chủ ý.
- **`draft` mặc định là `true`.** Quên khai `draft: false` thì bài sẽ không hiện.
- **`noi_bat: true`** đưa bài lên khối "Câu chuyện nổi bật" ở trang chủ.
- **`ngay_dang`** viết dạng `2025-08-01`, không phải `01/08/2025`.

### Podcast và phóng sự

Giống bài viết, nhưng có `youtube_id` thay cho nội dung:

```markdown
---
title: 'PODCAST | CẦN THƠ — Chuyện chợ nổi Cái Răng'
mo_ta: 'Mô tả ngắn'
youtube_id: 'EwPUttypYDs'
ngay_dang: 2025-08-01
draft: false
---
```

`youtube_id` là **mã 11 ký tự**, không phải cả đường link.
Với `https://youtube.com/shorts/EwPUttypYDs` thì mã là `EwPUttypYDs`.
Dán nhầm cả link sẽ bị chặn lúc build.

---

## 4. Ảnh

Ảnh **không** lưu trong repo. Tất cả nằm trên Cloudinary (tài khoản `doljk7ymy`).

Quy trình: tải ảnh lên Cloudinary → copy đường dẫn → dán vào `anh_bia`.

Hàm `anhToiUu()` trong `src/lib/img.ts` tự chèn `f_auto,q_auto,w_*` vào URL,
nên ảnh tự chuyển sang WebP, tự nén và giới hạn kích thước. Các trang đã gọi sẵn hàm này.

**Ảnh chèn trong thân bài thì phải tự thêm tham số**, vì Markdown không đi qua hàm đó:

```markdown
![Chú thích ảnh](https://res.cloudinary.com/doljk7ymy/image/upload/f_auto,q_auto,w_900/v123/anh.jpg)
```

Thiếu đoạn `f_auto,q_auto,w_900/` thì ảnh vẫn hiện nhưng nặng gấp nhiều lần.

---

## 5. Trang quản trị (CMS)

Địa chỉ: `<địa-chỉ-site>/admin`

Dùng [Sveltia CMS](https://github.com/sveltia/sveltia-cms), cấu hình ở `public/admin/config.yml`.
Cho phép đăng bài bằng giao diện, không cần biết Markdown hay Git.

Bài đăng qua CMS sẽ tạo **Pull Request** trên GitHub để duyệt trước khi lên web
(chế độ `editorial_workflow`).

> **Trạng thái: chưa kích hoạt đăng nhập.** Cần cấu hình xác thực GitHub
> (PAT trước, OAuth sau) thì trang `/admin` mới dùng được.

---

## 6. Deploy

Host trên **Cloudflare Pages**, build từ nhánh `main`.

| Thiết lập | Giá trị |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22.12.0` trở lên |

Cloudflare tự chạy `npm install` trên máy chủ Linux của nó. **Không được commit
thư mục `node_modules`** — thư mục đó chứa file nhị phân gắn với hệ điều hành của
máy bạn (Windows), đẩy lên sẽ làm build trên Cloudflare thất bại với lỗi
`Cannot find native binding`. File `.gitignore` đã chặn sẵn việc này.

Sau khi deploy xong, sửa `site` trong `astro.config.mjs` cho khớp địa chỉ thật,
và sửa `site_url` trong `public/admin/config.yml`.

---

## 7. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| `astro:content` gạch đỏ trong VS Code | Chưa sinh type | `npx astro sync`, rồi Ctrl+Shift+P → *Restart TS Server* |
| `Cannot find module 'astro/config'` | Thiếu `node_modules` | `npm install` |
| `Cannot find native binding` | `node_modules` bị commit từ máy khác hệ điều hành | Xoá `node_modules`, chạy lại `npm install` |
| Build báo lỗi schema ở một file `.md` | Sai hoặc thiếu trường bắt buộc | Đọc kỹ tên file trong thông báo lỗi, đối chiếu mẫu ở mục 3 |
| Bấm vào bài ra 404 | Cache cũ | Xoá thư mục `.astro`, chạy lại `npm run dev` |
| Bài đã viết nhưng không hiện | Thiếu `draft: false` | Thêm vào frontmatter |
| Chuyên mục trống trơn | `chuyen_muc` gắn sai giá trị | Kiểm tra lại đúng 1 trong 4 giá trị hợp lệ |
| `Invalid route [chuyen-muc]` | Tên thư mục tham số có gạch ngang | Astro cấm — phải viết `[chuyenMuc]` |

---

## 8. Quy ước bắt buộc

1. **Luôn dùng gạch ngang** cho tên file và đường dẫn: `lich-su`, `lang-nghe`.
   Hai ngoại lệ: thư mục tham số `[chuyenMuc]` (Astro cấm gạch ngang ở đó),
   và `about_us.astro` (giữ theo tên đang dùng).
2. **Nội dung tách khỏi giao diện.** Thêm bài chỉ là thêm file `.md`, không đụng code.
3. **Một nguồn dữ liệu duy nhất.** Thông tin chuyên mục khai ở `src/lib/chuyenMuc.ts`,
   không lặp lại ở nơi khác.
4. Trong TypeScript, dùng `const f = () => {}` thay `function f() {}` khi cần giữ
   kết quả kiểm tra null.
5. Bất cứ thứ gì `getStaticPaths` cần đều phải `import` từ file khác,
   không khai `const` trong cùng file.

---

## 9. Bàn giao tài khoản

Dự án hiện phụ thuộc vào **một người duy nhất**. Cần ít nhất một người thứ hai
có quyền truy cập những tài khoản sau:

- [ ] GitHub — repo `NguyenHoaiNam-1158/mekong-tales`
- [ ] Cloudflare — Pages project
- [ ] Cloudinary — tài khoản `doljk7ymy` chứa toàn bộ ảnh
- [ ] Tên miền (khi mua)
- [ ] Email dự án `mekongtales@gmail.com`

Ảnh nằm ngoài repo, nên **mất tài khoản Cloudinary là mất toàn bộ ảnh**.
Việc này quan trọng ngang với việc sao lưu code.