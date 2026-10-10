# הגדרות Firebase ו-Railway

## Firebase (פרויקט `asshole-720d9`)
1. **Authentication → Sign-in method:** להפעיל Google.
2. **Authentication → Settings → Authorized domains:** להוסיף את הדומיין של Railway (למשל `xxx.up.railway.app`). `localhost` כבר קיים.
3. **Firestore Database:** ליצור (Production mode).
4. **Rules:** להדביק את `firestore.rules` ב-Firestore → Rules → Publish
   (או: `npx firebase-tools deploy --only firestore:rules --project asshole-720d9`).
5. **Service account (סוד!):** Project settings → Service accounts → Generate new private key.
   את הקובץ שומרים כמשתנה ב-Railway, לא ב-git ולא בצ'אט.

## Railway
| הגדרה | ערך |
|---|---|
| Root Directory | ריק |
| Build Command | `npm run build` |
| Start Command | `npm run start` |
| Healthcheck Path | `/health` |
| Replicas | 1 |

משתני סביבה:
- `FIREBASE_SERVICE_ACCOUNT` – תוכן ה-JSON של ה-service account (או base64 שלו, אם Railway מתלונן על מרכאות/שורות חדשות: `base64 -w0 key.json`).
- `CORS_ORIGIN` – (אופציונלי) כתובת האתר, למשל `https://xxx.up.railway.app`. הקליינט והשרת באותו origin, ולכן `*` עובד גם.
- `PLAYERS`, `TURN_MS`, `BOT_DELAY_MS` – אופציונליים.

**בלי `FIREBASE_SERVICE_ACCOUNT` השרת עולה במצב פיתוח**: אין אימות, ואפשר להתחזות לכל uid. זה נועד רק ללוקאל.
כשהמשתנה מוגדר, מצב הפיתוח נדחה והכניסה היא רק עם Google.

## בדיקה מקומית עם 4 טאבים
- `npm run dev` + `npm run dev:client` ואז `http://localhost:5173/?name=דנה` (פעם שנייה: `?name=יוסי` וכו').
- כשיש `FIREBASE_SERVICE_ACCOUNT` מקומי, מצב `?name=` נחסם – משתמשים ב-Google.
