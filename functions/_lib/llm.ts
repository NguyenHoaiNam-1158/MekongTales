import type { WorkersAI } from './rag';

export interface CauHinhLLM {
  nhaCungCap: string;
  khoa: string;
  model: string;
  ai?: WorkersAI;
}

export const HE_THONG = `Bạn là trợ lý của Mekong Tales, một trang tư liệu về di sản văn hoá vùng sông Tiền — miền Tây Nam Bộ.

QUY TẮC BẮT BUỘC:
1. Chỉ trả lời dựa trên phần TƯ LIỆU được cung cấp. Tuyệt đối không dùng kiến thức bên ngoài.
2. Nếu tư liệu không đủ để trả lời, hãy nói thẳng là trang chưa có thông tin về việc đó, rồi gợi ý chủ đề gần nhất mà tư liệu có.
3. Sau mỗi ý lấy từ tư liệu, ghi số nguồn trong ngoặc vuông, ví dụ [Nguồn 1].
4. Không bịa tên người, số liệu, năm tháng hay địa danh không có trong tư liệu.
5. Trả lời bằng tiếng Việt, giọng thân thiện và gọn. Tối đa 4 đoạn.`;

export function dungPrompt(cauHoi: string, nguQuanh: string): string {
  return `TƯ LIỆU:\n\n${nguQuanh}\n\n---\n\nCÂU HỎI: ${cauHoi}`;
}

// Workers AI: chạy ngay trong hạ tầng Cloudflare, không gọi HTTP ra ngoài,
// nên không bao giờ bị chặn theo vùng như Gemini.
async function goiWorkersAI(c: CauHinhLLM, prompt: string): Promise<string> {
  if (!c.ai) throw new Error('Thiếu binding AI cho Workers AI');
  const res = (await c.ai.run(c.model, {
    messages: [
      { role: 'system', content: HE_THONG },
      { role: 'user', content: prompt },
    ],
    max_tokens: 800,
    temperature: 0.3,
  })) as { response?: string };
  const text = res.response;
  if (!text) throw new Error(`Workers AI không trả về nội dung: ${JSON.stringify(res).slice(0, 300)}`);
  return text;
}

async function goiGemini(c: CauHinhLLM, prompt: string): Promise<string> {
  // Khoá AQ. (Auth key mới của Google) phải gửi qua ?key= trên URL.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent?key=${encodeURIComponent(c.khoa)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: HE_THONG }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('');
  if (!text) throw new Error(`Gemini không trả về nội dung: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

async function goiAnthropic(c: CauHinhLLM, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': c.khoa,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: c.model,
      max_tokens: 800,
      temperature: 0.3,
      system: HE_THONG,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  return json.content.map((b: any) => b.text ?? '').join('');
}

async function goiOpenAI(c: CauHinhLLM, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.khoa}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: c.model,
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: 'system', content: HE_THONG },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  return json.choices[0].message.content;
}

export function goiLLM(c: CauHinhLLM, prompt: string): Promise<string> {
  switch (c.nhaCungCap) {
    case 'workers-ai':
      return goiWorkersAI(c, prompt);
    case 'gemini':
      return goiGemini(c, prompt);
    case 'anthropic':
      return goiAnthropic(c, prompt);
    case 'openai':
      return goiOpenAI(c, prompt);
    default:
      throw new Error(`Không hỗ trợ nhà cung cấp "${c.nhaCungCap}"`);
  }
}