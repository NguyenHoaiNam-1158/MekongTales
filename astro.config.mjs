// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // Đổi khi có tên miền riêng. Không để dấu / ở cuối.
  site: 'https://mekong-tales.pages.dev',

  output: 'static',
  adapter: cloudflare(),
});