// Tách thân bài Markdown thành các đoạn, để chèn khối ảnh vào giữa theo sau_doan.
// Chỉ tách ở cấp đoạn (dòng trống ngăn cách), không đụng tới cú pháp bên trong.
export function tachDoan(markdown: string): string[] {
  return markdown
    // Chuẩn hoá xuống dòng TRƯỚC khi tách.
    //
    // Trên Windows, git đổi LF thành CRLF lúc checkout, nên dòng trống trong
    // file là "\r\n\r\n". Hai ký tự \n khi đó không liền nhau, /\n{2,}/ không
    // khớp, cả thân bài bị coi là MỘT đoạn và mọi khối ảnh từ đoạn 2 trở đi
    // biến mất — mà chỉ biến mất ở máy, còn trang thật (build trên Linux) vẫn
    // đúng. Không có dòng này thì bản xem thử ở máy khác hẳn bản chạy thật.
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((d) => d.trim())
    .filter(Boolean);
}
