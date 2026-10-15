import { defineConfig } from 'vitest/config';

// בדיקות שמשחקות משחקים מלאים מול שרת אמיתי: תקרת הזמן הברירתית (5 שנ') קצרה מדי כשהמשחק האקראי ארוך
export default defineConfig({ test: { testTimeout: 60_000 } });
