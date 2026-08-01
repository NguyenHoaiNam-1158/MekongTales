// Dữ liệu 5 tỉnh thành Đồng bằng sông Cửu Long theo địa giới SAU sáp nhập 2025.
//
// Từ 1/7/2025 cả nước còn 34 tỉnh thành; riêng miền Tây 13 tỉnh cũ gộp lại còn 5.
// Long An sáp nhập vào Tây Ninh nên không nằm trong bản đồ này.
//
// Nội dung nằm ở src/data/tinh-thanh.json — file JSON chứ không phải TS, để
// scripts/*.mjs (chạy bằng Node thuần) đọc chung được cùng một nguồn dữ liệu.
// Sửa thông tin tỉnh thì sửa file JSON đó, đừng sửa file này.

import duLieu from '../data/tinh-thanh.json';

export interface ThongTinTinh {
  ma: string;          // mã tỉnh, khớp với property `ma` trong public/data/dbscl.geojson
  ten: string;         // tên hiển thị
  slug: string;        // slug để lọc bài viết
  sap_nhap: string[];  // các tỉnh cũ đã gộp vào
  gioi_thieu: string;
  dac_san: string[];
  di_tich: string[];
  // Slug các tỉnh CŨ. Bài viết đã đặt `dia_diem.tinh_slug` theo tên tỉnh cũ
  // (ví dụ 'tien-giang') vẫn tra được về đúng tỉnh mới, không phải sửa lại bài.
  slug_cu: string[];
}

export const CAC_TINH: ThongTinTinh[] = duLieu;

/** Tra tỉnh mới từ slug — nhận cả slug mới lẫn slug tỉnh cũ trước sáp nhập. */
export function timTinhTheoSlug(slug: string): ThongTinTinh | undefined {
  return CAC_TINH.find((t) => t.slug === slug || t.slug_cu.includes(slug));
}
