import {
  tinhVectorCauHoi,
  timDoanLienQuan,
  ghepNguQuanh,
  gomNguon,
  thongTinKho,
  type WorkersAI,
} from '../lib/rag';
import { goiLLM, dungPrompt, type CauHinhLLM } from '../lib/llm';

interface Env {
  AI: WorkersAI;
  LLM_NHA_CUNG_CAP?: string;
  LLM_KHOA: string;
  LLM_MODEL?: string;
}

// Cloudflare truyền vào một object lớn hơn, ta chỉ khai phần thực sự dùng.
interface NguCanh {
  request: Request;
  env: Env;
}

const TOI_DA_KY_TU = 500;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export const onRequestGet = async (): Promise<Response> =>
  json({ trang_thai: 'san sang', ...thongTinKho });

export const onRequestPost = async ({ request, env }: NguCanh): Promise<Response> => {
  let cauHoi: string;
  try {
    const body = (await request.json()) as { cau_hoi?: unknown };
    cauHoi = typeof body.cau_hoi === 'string' ? body.cau_hoi.trim() : '';
  } catch {
    return json({ loi: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  if (!cauHoi) return json({ loi: 'Bạn chưa nhập câu hỏi.' }, 400);
  if (cauHoi.length > TOI_DA_KY_TU)
    return json({ loi: `Câu hỏi quá dài, tối đa ${TOI_DA_KY_TU} ký tự.` }, 400);
  if (!env.LLM_KHOA) return json({ loi: 'Máy chủ chưa được cấu hình khoá API.' }, 500);

  const cauHinh: CauHinhLLM = {
    nhaCungCap: env.LLM_NHA_CUNG_CAP ?? 'gemini',
    khoa: env.LLM_KHOA,
    model: env.LLM_MODEL ?? 'gemini-2.5-flash',
  };

  try {
    const vector = await tinhVectorCauHoi(cauHoi, env.AI);
    const lienQuan = timDoanLienQuan(vector);

    if (!lienQuan.length) {
      return json({
        tra_loi:
          'Xin lỗi, trang chưa có tư liệu về nội dung này. Bạn thử hỏi về ẩm thực, làng nghề hoặc các cồn trên sông Tiền xem sao.',
        nguon: [],
      });
    }

    const traLoi = await goiLLM(cauHinh, dungPrompt(cauHoi, ghepNguQuanh(lienQuan)));
    return json({ tra_loi: traLoi, nguon: gomNguon(lienQuan) });
  } catch (e) {
    console.error('chat:', e);
    return json({ loi: 'Trợ lý đang gặp sự cố, bạn thử lại sau ít phút.' }, 502);
  }
};