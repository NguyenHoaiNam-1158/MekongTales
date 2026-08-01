import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chuyenMuc = z.enum(['ki-uc', 'am-thuc', 'lang-nghe', 'lich-su']);

const baiViet = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/bai-viet' }),
  schema: z.object({
    title: z.string(),
    mo_ta: z.string().max(200),
    anh_bia: z.string(),   
    anh_bia_alt: z.string(),
    chuyen_muc: chuyenMuc,
    tags: z.array(z.string()).default([]),
    tac_gia: z.string(),
    ngay_dang: z.coerce.date(),
    noi_bat: z.boolean().default(false),
    draft: z.boolean().default(true),
    dia_diem: z
      .object({
        ten: z.string().optional(),
        tinh: z.string().optional(),
        tinh_slug: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    khoi_anh: z
      .array(
        z.object({
          // Chèn khối này ngay SAU đoạn văn thứ mấy trong thân bài (đếm từ 1).
          sau_doan: z.number().int().min(0).default(0),
          kieu: z.enum(['luong', 'luoi-2', 'luoi-3', 'luoi-lech', 'ben-trai', 'ben-phai']),
          chu_thich: z.string().optional(),
          // Với ben-trai / ben-phai: đoạn chữ chảy cạnh ảnh.
          chu: z.string().optional(),
          anh: z
            .array(z.object({ src: z.string(), alt: z.string().default('') }))
            .min(1),
        })
      )
      .default([]),
  }),
});

const podcast = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/podcast' }),
  schema: z.object({
    title: z.string(),
    mo_ta: z.string(),
    youtube_id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/, 'Phải là mã video 11 ký tự, không phải link'),
    anh_bia: z.string().optional(),
    chuyen_muc: chuyenMuc.optional(),
    ngay_dang: z.coerce.date(),
    draft: z.boolean().default(true),
  }),
});

const phongSu = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/phong-su' }),
  schema: z.object({
    title: z.string(),
    mo_ta: z.string(),
    youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    anh_bia: z.string().optional(),
    ngay_dang: z.coerce.date(),
    draft: z.boolean().default(true),
  }),
});

const thanhVien = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/thanh-vien' }),
  schema: z.object({
    title: z.string(),
    vai_tro: z.string(),
    anh: z.string().optional(),
    thu_tu: z.number().default(99),
    giang_vien: z.boolean().default(false),
  }),
});

export const collections = {
  'bai-viet': baiViet,
  podcast,
  'phong-su': phongSu,
  'thanh-vien': thanhVien,
};