import { useClient } from '../lib/client';
import { useNavGuard } from '../lib/nav';
import { useSession } from '../lib/session';
import { ProfileScreen } from '../components/ProfileScreen';

export function ProfilePage() {
  const c = useClient();
  const guard = useNavGuard();
  const session = useSession();
  const me = c.profile?.profile;
  if (!me) return null;
  return (
    <ProfileScreen
      profile={me} dev={session.dev} error={c.profileError}
      onRename={c.actions.setUsername} onSignOut={guard.requestSignOut} onLinked={session.relink}
    />
  );
}
