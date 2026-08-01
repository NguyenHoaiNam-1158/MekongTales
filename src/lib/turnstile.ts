// Khoá công khai của Turnstile — được nhúng thẳng vào HTML nên không phải bí mật.
//
// Mặc định là khoá THỬ NGHIỆM chính thức của Cloudflare: luôn vượt qua kiểm tra.
// Nhờ vậy chạy ở máy không phải cấu hình gì, nhưng cũng có nghĩa là KHÔNG có lớp
// chống thư rác nào. Bản chạy thật bắt buộc đặt PUBLIC_TURNSTILE_SITE_KEY.

const KHOA_THU = '1x00000000000000000000AA';

export const khoaTurnstile: string =
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? KHOA_THU;

export const dungKhoaThuNghiem = khoaTurnstile === KHOA_THU;

// Đoạn này nằm ở cấp module nên chỉ chạy một lần cho cả lần build, thay vì lặp
// lại theo từng trang bài viết.
//
// CF_PAGES do Cloudflare Pages tự đặt khi build trên hạ tầng của họ. Build ở máy
// thì biến này không có — và ở máy dùng khoá thử nghiệm là đúng, không cần nhắc.
if (
  dungKhoaThuNghiem &&
  typeof process !== 'undefined' &&
  process.env?.CF_PAGES
) {
  console.warn(
    '\n[phan-hoi] CẢNH BÁO: đang build bằng khoá Turnstile thử nghiệm.\n' +
      '           Khung bình luận sẽ không chặn được bot.\n' +
      '           Đặt PUBLIC_TURNSTILE_SITE_KEY trong Pages › Settings ›\n' +
      '           Environment variables (mục Build) rồi deploy lại.\n'
  );
}
