// Nguồn duy nhất cho thông tin các chuyên mục.
// Mỗi mục có thể có phần mở đầu riêng (hero_title, intro, muc_bai_viet).

export type ChuyenMucInfo = {
  ten: string;
  mo_ta: string;
  hero_title?: string;      // tiêu đề lớn ở đầu trang, nếu khác tên chuyên mục
  intro?: string[];         // các đoạn văn dẫn nhập
  muc_bai_viet?: string;    // tiêu đề khối danh sách bài
};

export const CHUYEN_MUC = {
  'ki-uc': {
    ten: 'Kí ức Mekong',
    mo_ta: 'Ký ức cộng đồng, chuyện mưu sinh và nếp sống ven sông của người miền Tây.',
  },
  'am-thuc': {
    ten: 'Ẩm thực Mekong',
    mo_ta: 'Ký hiệu học của những đặc sản khói lửa trứ danh vùng châu thổ sông Tiền.',
    hero_title: 'MEKONG FOOD',
    intro: [
      `Giữa thời đại mà mọi xúc cảm đều bị nén chặt vào những thuật toán số hóa và những chiếc màn hình cảm ứng vô hồn, thế hệ chúng ta đang mải miết đi tìm những liệu pháp "chữa lành" trong thế giới giả lập. Nhưng bạn có bao giờ nghĩ, miền Tây nơi lưu vực sông Tiền trù phú đã nắm giữ một "giao diện truyền thông giác quan" (sensory interface) hoàn mỹ từ hàng thế kỷ trước?`,
      `Không dừng lại ở những bài review ẩm thực bề nổi, loạt phóng sự này dưới góc nhìn của Mekong Tales sẽ đưa bạn đi sâu vào thế giới ký hiệu học của các đặc sản sông nước trứ danh: từ khúc ASMR chữa lành của chiếc bánh xèo mộc mạc, triết lý "kết nối analog" của nồi lẩu Cù Lao, thẩm mỹ phù du của tô canh chua cá linh bông điên điển mùa lũ, cho đến nghịch lý đầy quyến rũ giữa hủ tiếu Mỹ Tho kiêu kỳ và chuột đồng quay lu hoang dã.`,
      `Hãy tắt bớt một tab trình duyệt, chậm lại một nhịp thở, và bắt đầu hành trình giải mã những di sản khói lửa đầy kiêu hãnh của vùng châu thổ ngập nước.`,
    ],
    muc_bai_viet: 'Xem thêm các bài viết nổi bật tháng này',
  },
  'lang-nghe': {
    ten: 'Làng nghề Mekong',
    mo_ta: 'Những làng nghề truyền thống gìn giữ tinh hoa thủ công của miền Tây.',
  },
  'lich-su': {
    ten: 'Lịch sử',
    mo_ta: 'Dòng chảy lịch sử hình thành nên vùng đất và con người sông Tiền.',
  },
} satisfies Record<string, ChuyenMucInfo>;

export type ChuyenMucSlug = keyof typeof CHUYEN_MUC;