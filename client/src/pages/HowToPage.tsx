import { useNavigate } from 'react-router-dom';
import { NeonCard } from '../components/NeonCard';
import { NeonScreen } from '../components/NeonBackground';
import { NeonButton } from '../components/NeonButton';
import { Panel } from '../components/ui';

const ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel tone="dim">
      <h2 className="h-neon mb-2 text-xl">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed" style={{ fontFamily: 'var(--font-he)' }}>{children}</div>
    </Panel>
  );
}

/** איך משחקים: דף ציבורי (גם לפני כניסה), נפתח גם מהתפריט בלשונית חדשה */
export function HowToPage() {
  const nav = useNavigate();
  const back = () => (window.history.state?.idx > 0 && !window.opener ? nav(-1) : window.opener ? window.close() : nav('/'));
  return (
    <NeonScreen>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6" style={{ direction: 'rtl' }}>
        <h1 className="h-neon text-center text-3xl">איך משחקים פריזידנט</h1>
        <p className="neon-dim text-center text-sm">המטרה: להיפטר מכל הקלפים ביד כמה שיותר מהר. מי שמסיים ראשון הוא הפריזידנט, והאחרון הוא האסהול.</p>

        <Sec title="סדר הקלפים">
          <p>מהנמוך לגבוה. הצורה (♠♥♦♣) לא משפיעה על הדירוג.</p>
          <div className="flex flex-wrap justify-center gap-1" dir="ltr">
            {ORDER.map((r) => <NeonCard key={r} rank={r} suit={r % 2 ? 'H' : 'S'} size="xs" />)}
          </div>
          <p>ה-2 הוא הקלף הגבוה ביותר.</p>
        </Sec>

        <Sec title="מהלך של סרייה">
          <p>מי שמחזיק 3♣ פותח, והמהלך הראשון חייב לכלול אותו.</p>
          <p>הפותח בוחר כמות: קלף בודד, זוג, שלשה או רביעייה (קלפים מאותו מספר).</p>
          <p>כל שחקן אחריו חייב לשים <b>אותה כמות</b>, במספר <b>שווה או גבוה</b> מהמהלך הקודם.</p>
          <p>אפשר תמיד לעשות <b>פס</b>, ואפשר להיכנס שוב כשהתור חוזר אליך.</p>
          <p>אם כולם עושים פס, מי ששם את המהלך האחרון פותח סרייה חדשה עם מה שבא לו.</p>
        </Sec>

        <Sec title="קלפים מיוחדים">
          <p><b>2 חותך:</b> 2 אחד חותך כל מהלך, גם זוג או שלשה. זוג או שלשה של 2 חותכים גם הם (כשהכמות מתאימה). אחרי חיתוך הסרייה נסגרת ומי שחתך פותח מחדש, תור חופשי.</p>
          <p><b>דילוג:</b> אם שמת מספר זהה לקודם (9 על 9, או זוג 9 על זוג 9), השחקן הבא בתור מדולג.</p>
          <p><b>השלמה לרביעייה:</b> אם הקלפים על השולחן מגיעים יחד ל-4 מאותו מספר, הסרייה נסגרת ומי שהשלים פותח מחדש. מותר גם לשים קלף בודד על שלשה כדי להשלים רביעייה.</p>
          <p><b>7 – יורדים:</b> אחרי 7 המהלך הבא חייב להיות נמוך מ-7, או 7 נוסף. 2 עדיין חותך.</p>
        </Sec>

        <Sec title="תארים והחלפת קלפים">
          <p>סדר הסיום קובע תואר: פריזידנט, סגן פריזידנט, (מידל בחמישה שחקנים), סגן אסהול ואסהול.</p>
          <p>במשחק הבא מחליפים קלפים: האסהול נותן לפריזידנט את 2 הקלפים הכי טובים שלו, והפריזידנט מחזיר 2 קלפים לבחירתו. סגן אסהול וסגן פריזידנט מחליפים קלף אחד. יש 30 שניות לבחור מה להחזיר.</p>
        </Sec>

        <Sec title="ניקוד ודרגות">
          <p>פריזידנט +3, סגן פריזידנט +1, מידל 0, סגן אסהול −1, אסהול −2.</p>
          <p>הניקוד נספר כשיש במשחק לפחות שני שחקנים אנושיים (לא רק בוטים). הנקודות מעלות אותך בדרגות: אזרח, חבר מועצה, ראש עיר, שר, ראש ממשלה ונשיא. כל דרגה פותחת חבילת קלפים יפה יותר.</p>
          <p>אם יוצאים באמצע משחק, בוט ממשיך במקומך ואתה מדורג אחרון.</p>
        </Sec>

        <div className="mx-auto w-full max-w-xs"><NeonButton onClick={back}>הבנתי, חזרה</NeonButton></div>
      </div>
    </NeonScreen>
  );
}
