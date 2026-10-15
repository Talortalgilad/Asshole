# הגדרות Firebase ו-Railway

## Firebase (פרויקט `asshole-720d9`)
1. **Authentication → Sign-in method:** להפעיל Google.
2. **Authentication → Settings → Authorized domains:** להוסיף את הדומיין של Railway (למשל `xxx.up.railway.app`). `localhost` כבר קיים.
3. **Firestore Database:** ליצור (Production mode).
4. **Rules:** להדביק את `firestore.rules` ב-Firestore → Rules → Publish (**לפרסם מחדש אחרי כל עדכון של הקובץ**: נוספה הקולקציה `leaderboard`)
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
- `TURN_MS`, `BOT_DELAY_MS`, `EXCHANGE_MS`, `EXCHANGE_REVIEW_MS`, `GRACE_MS`, `WAIT_GRACE_MS` – אופציונליים (זמנים במילישניות; שימושי לבדיקות מהירות).

**בלי `FIREBASE_SERVICE_ACCOUNT` השרת עולה במצב פיתוח**: אין אימות, ואפשר להתחזות לכל uid. זה נועד רק ללוקאל.
כשהמשתנה מוגדר, מצב הפיתוח נדחה והכניסה היא רק עם Google.

## בדיקה מקומית עם 4 טאבים
- `npm run dev` + `npm run dev:client` ואז `http://localhost:5173/?name=דנה` (פעם שנייה: `?name=יוסי` וכו').
- כשיש `FIREBASE_SERVICE_ACCOUNT` מקומי, מצב `?name=` נחסם – משתמשים ב-Google.

## אבחון: ההתחברות עם Google לא עובדת
1. **פותחים `https://<הדומיין>/health`** – צריך להחזיר `"auth":"firebase"`. אם כתוב `"dev"` – `FIREBASE_SERVICE_ACCOUNT` לא הוגדר ב-Railway (או שהדיפלוי לא נקלט).
2. **לוג Railway בעליית השרת** (Deployments → View logs):
   - `✅ [firebase] Admin אותחל. project=… service-account=…` – הסוד נקרא ופוענח.
   - `✅ Auth Admin פועל` / `✅ Firestore נגיש` – ההרשאות תקינות.
   - `❌ Firestore נכשל … NOT_FOUND` – לא נוצר Firestore Database בפרויקט.
   - `❌ Auth Admin נכשל … invalid_grant` – המפתח בוטל/לא שייך לפרויקט. יוצרים מפתח חדש.
   - `⚠️ project_id … שונה` – ה-service account מפרויקט אחר מ-`asshole-720d9`.
   - `❌ FIREBASE_SERVICE_ACCOUNT … אינו JSON תקין` – השרת מסרב לעלות (בכוונה). נסו base64: `base64 -w0 key.json`.
   - `[auth] חיבור נדחה: …` – טוקן נדחה, והסיבה כתובה (למשל `incorrect 'aud' claim` = פרויקט לא תואם).
3. **הדפדפן:** הכפתור מציג עכשיו קוד שגיאה (או `timeout` אחרי 15 שניות) במקום להיתקע. אם נדחה אחרי ההתחברות מופיע מסך "השרת דחה את ההתחברות".
4. **Headers:** השרת שולח `Cross-Origin-Opener-Policy: same-origin-allow-popups` (נדרש לחלון הקופץ). ב-DevTools → Network → המסמך הראשי, ודאו שזה ה-header שמגיע (שום שכבה לפני השרת לא אמורה לדרוס אותו ל-`same-origin`).
5. אם הקוד הוא `auth/unauthorized-domain` – מוסיפים את הדומיין ב-Authentication → Settings → Authorized domains.

## אבחון: מסך ירוק ריק אחרי הכניסה
- **הסיבה הנפוצה (תוקנה):** יש כרגע שולחן אחד גלובלי. אם משחק כבר רץ (או נשאר ממשחק קודם ששחקן מחובר בו), שחקן חדש לא יכול להצטרף. עד עכשיו ה-UI שתק, והמסך נשאר ריק. עכשיו מוצג "המשחק כבר התחיל" / "השולחן מלא" עם קוד, וניסיון חוזר אוטומטי כל 5 שניות.
- **איך משחררים את השולחן:** המארח לוחץ בסוף המשחק "חזרה לחדר ההמתנה". אם אף אדם לא מחובר 60 שניות, השולחן מתאפס לבד. אם נשאר טאב ישן פתוח של המארח, סוגרים אותו.
- **דף בדיקה ל-Error Boundary:** `/?preview=crash` מציג את מסך ההתרסקות.
- **בלוג Railway:** `[db] טעינת פרופיל נכשלה` או `[db] שמירת שם משתמש נכשלה` = בעיה ב-Firestore (למשל `5 NOT_FOUND` – לא נוצר Firestore Database; `7 PERMISSION_DENIED` – הרשאות ה-service account).


## ניקוד וטבלת אלופים
- הניקוד נכתב מהשרת ל-Firestore (`users`, `leaderboard`, `monthlyStats`, `games`). בלי Firestore אמיתי לא יהיה ניקוד.
- לבדיקה מקומית בלי Firebase: `DEV_SCORING=1 npm run dev` (ו-`?name=דנה&guest=1` מדמה אורח).
- אם הטבלה ריקה אחרי משחק: בדקו בלוג `[db] שמירת ניקוד נכשלה`, ושהכללים פורסמו.

## בדיקת e2e במובייל
`npm run e2e` בונה את הלקוח, מרים שרת פיתוח מקומי ומריץ Chromium במסך 375px עם מגע:
יצירת שולחן, פתיחה/סגירה של דיאלוג ותפריט (לא מוציאים מהשולחן), אישור "לצאת ולסגור את השולחן?" למארח,
הוספת 3 בוטים והתחלת משחק. אפשר לציין דפדפן עם `CHROME_PATH`.
