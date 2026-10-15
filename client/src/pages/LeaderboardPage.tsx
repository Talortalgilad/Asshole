import { Panel } from '../components/ui';

export function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <Panel>
        <div className="py-6 text-center">
          <div className="mb-2 text-5xl" aria-hidden="true">🏆</div>
          <h2 className="h-neon mb-2 text-2xl">טבלת אלופים</h2>
          <p className="label-dim">הטבלה תהיה זמינה בקרוב: ניקוד, דרגות ודירוג חודשי.</p>
        </div>
      </Panel>
    </div>
  );
}
