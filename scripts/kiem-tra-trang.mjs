// Kiểm tra nhanh xem trang đã chạy đúng chưa: chatbot, bình luận, chống spam.
//
// Viết bằng Node để chạy giống nhau trên PowerShell, CMD lẫn bash — `curl` trong
// PowerShell thật ra là bí danh của Invoke-WebRequest nên không hiểu cờ -H, -d.
//
//   npm run kiem-tra                          kiểm tra trang thật
//   npm run kiem-tra -- http://localhost:8788 kiểm tra máy chủ ở máy

const GOC = (process.argv[2] ?? 'https://mekongtales.pages.dev').replace(/\/$/, '');
const BAI = '2025-07-15-banh-xeo';

// Khoá Turnstile thử nghiệm của Cloudflare — thấy khoá này trên trang thật
// nghĩa là chưa đặt PUBLIC_TURNSTILE_SITE_KEY.
const KHOA_THU = '1x00000000000000000000AA';

let dat = 0;
let hong = 0;
let luuY = 0;

const bao = (trangThai, ten, chiTiet = '') => {
  const dau = { ok: '  OK  ', loi: ' LỖI  ', y: ' LƯU Ý' }[trangThai];
  console.log(`${dau} │ ${ten}${chiTiet ? '\n       │   ' + chiTiet : ''}`);
  if (trangThai === 'ok') dat++;
  else if (trangThai === 'loi') hong++;
  else luuY++;
};

const lay = async (duong, tuyChon) => {
  const res = await fetch(GOC + duong, tuyChon);
  const chu = await res.text();
  let json = null;
  try {
    json = JSON.parse(chu);
  } catch {
    /* không phải JSON, giữ nguyên chuỗi */
  }
  return { res, chu, json };
};

const guiJson = (than) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(than),
});

console.log(`\nKiểm tra: ${GOC}\n${'─'.repeat(64)}`);

// ---------------------------------------------------------------- trang tĩnh
for (const duong of ['/', '/ban-do/', '/quyen-rieng-tu/', `/bai-viet/${BAI}/`]) {
  try {
    const { res } = await lay(duong);
    res.ok ? bao('ok', `Trang ${duong}`) : bao('loi', `Trang ${duong}`, `HTTP ${res.status}`);
  } catch (e) {
    bao('loi', `Trang ${duong}`, e.message);
  }
}

// ------------------------------------------------------------------ chatbot
try {
  const { json } = await lay('/api/chat');
  if (json?.soDoan) {
    bao('ok', 'Kho tri thức', `${json.soDoan} đoạn / ${json.soTrang} trang · tạo lúc ${json.taoLuc?.slice(0, 16)}`);
  } else {
    bao('loi', 'Kho tri thức', 'không đọc được số đoạn');
  }
} catch (e) {
  bao('loi', 'Kho tri thức', e.message);
}

try {
  const { json } = await lay('/api/chat', guiJson({ cau_hoi: 'Mỹ Tho thuộc tỉnh nào?' }));
  if (json?.tra_loi) {
    bao('ok', 'Chatbot trả lời', json.tra_loi.replace(/\s+/g, ' ').slice(0, 90) + '…');
  } else {
    bao('loi', 'Chatbot trả lời', json?.loi ?? 'không rõ');
    console.log('       │   → xem model còn dùng được: npx wrangler ai models');
  }
} catch (e) {
  bao('loi', 'Chatbot trả lời', e.message);
}

// ------------------------------------------------- bình luận + khoá Turnstile
// Khoá bí mật thử nghiệm của Cloudflare CHẤP NHẬN MỌI VÉ, nên khi trang còn
// dùng khoá thử thì phép thử chống spam bên dưới không nói lên điều gì.
let dungKhoaThu = false;

try {
  const { json } = await lay(`/api/phan-hoi?bai=${BAI}`);
  if (json && Array.isArray(json.danh_sach)) {
    bao('ok', 'Đọc bình luận', `${json.tong} ý kiến · ${json.so_thich} lượt thích · điểm ${json.diem_tb ?? '—'}`);
    if (json.danh_sach.some((d) => 'email' in d))
      bao('loi', 'Rò rỉ email', 'API công khai đang trả về cột email!');

    const sk = json.turnstile_site_key;
    dungKhoaThu = sk === KHOA_THU;
    if (!sk) bao('loi', 'Khoá Turnstile công khai', 'API không trả về khoá');
    else if (dungKhoaThu)
      bao('y', 'Khoá Turnstile công khai', 'đang là khoá THỬ NGHIỆM — đặt biến TURNSTILE_SITE_KEY rồi deploy lại');
    else bao('ok', 'Khoá Turnstile công khai', sk.slice(0, 12) + '…');
  } else {
    bao('loi', 'Đọc bình luận', json?.loi ?? 'phản hồi lạ');
  }
} catch (e) {
  bao('loi', 'Đọc bình luận', e.message);
}

try {
  const { res, json } = await lay(
    '/api/phan-hoi',
    guiJson({ bai_slug: BAI, ten: 'Kiem tra', noi_dung: 've turnstile gia', dong_y: true, turnstile: 'sai' })
  );
  if (res.status === 403) bao('ok', 'Chống spam Turnstile', 'vé giả bị từ chối đúng như mong đợi');
  else if (res.status === 500 && /cấu hình/.test(json?.loi ?? ''))
    bao('y', 'Chống spam Turnstile', 'thiếu MUOI_BAM hoặc TURNSTILE_KHOA — bình luận đang tắt');
  else if (res.ok && dungKhoaThu)
    bao('y', 'Chống spam Turnstile', 'vé giả được chấp nhận — đúng như thiết kế của khoá thử nghiệm, chưa nói lên điều gì');
  else if (res.ok)
    bao('loi', 'Chống spam Turnstile', 'vé giả VẪN ĐƯỢC CHẤP NHẬN dù đang dùng khoá thật!');
  else bao('loi', 'Chống spam Turnstile', `HTTP ${res.status}: ${json?.loi ?? ''}`);
} catch (e) {
  bao('loi', 'Chống spam Turnstile', e.message);
}

try {
  const { res } = await lay(
    '/api/phan-hoi',
    guiJson({ bai_slug: BAI, ten: 'Kiem tra', noi_dung: 'khong tick dong y', dong_y: false, turnstile: 'x' })
  );
  res.status === 400
    ? bao('ok', 'Bắt buộc đồng ý quyền riêng tư', 'chặn ở phía máy chủ')
    : bao('loi', 'Bắt buộc đồng ý quyền riêng tư', `HTTP ${res.status}`);
} catch (e) {
  bao('loi', 'Bắt buộc đồng ý quyền riêng tư', e.message);
}

// ------------------------------------------------------------------ quản trị
try {
  const { res } = await lay('/api/quan-tri/phan-hoi');
  res.status === 401
    ? bao('ok', 'Trang duyệt cần khoá', 'không khoá thì bị từ chối')
    : bao('loi', 'Trang duyệt cần khoá', `HTTP ${res.status} — đáng lẽ phải 401`);
} catch (e) {
  bao('loi', 'Trang duyệt cần khoá', e.message);
}

// Có khoá thì thử luôn. Đặt trong biến môi trường để không lộ ra lịch sử lệnh.
if (process.env.QUAN_TRI_KHOA) {
  try {
    const { res, json } = await lay('/api/quan-tri/phan-hoi', {
      headers: { Authorization: `Bearer ${process.env.QUAN_TRI_KHOA}` },
    });
    res.ok
      ? bao('ok', 'Đăng nhập trang duyệt', `hàng chờ: ${json.thong_ke?.cho_duyet ?? 0} · đang hiện: ${json.thong_ke?.hien ?? 0}`)
      : bao('loi', 'Đăng nhập trang duyệt', `HTTP ${res.status} — khoá sai?`);
  } catch (e) {
    bao('loi', 'Đăng nhập trang duyệt', e.message);
  }
} else {
  console.log('       │ (đặt biến QUAN_TRI_KHOA để thử luôn việc đăng nhập trang duyệt)');
}

console.log('─'.repeat(64));
console.log(`Đạt: ${dat}   Lưu ý: ${luuY}   Lỗi: ${hong}\n`);
process.exit(hong > 0 ? 1 : 0);
