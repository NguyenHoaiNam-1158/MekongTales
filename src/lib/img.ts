export function anhToiUu(url: string | undefined, opts: { w?: number } = {}): string {
  if (!url) return '';
  const laCloudinary = url.includes('res.cloudinary.com') && url.includes('/upload/');
  if (!laCloudinary) return url;

  const params = ['f_auto', 'q_auto'];
  if (opts.w) params.push(`w_${opts.w}`, 'c_limit');
  return url.replace('/upload/', `/upload/${params.join(',')}/`);
}