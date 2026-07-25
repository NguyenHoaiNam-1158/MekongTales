// Tách thân bài Markdown thành các đoạn, để chèn khối ảnh vào giữa theo sau_doan.
// Chỉ tách ở cấp đoạn (dòng trống ngăn cách), không đụng tới cú pháp bên trong.
export function tachDoan(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((d) => d.trim())
    .filter(Boolean);
}