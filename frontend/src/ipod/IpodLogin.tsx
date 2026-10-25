import Ipod from './Ipod';
import { Screen, Message } from './Screens';
import { useIpodLook } from './settings';

interface IpodLoginProps {
  onLogin: () => void;
  error?: string | null;
  onClose?: () => void;
}

function IpodLogin({ onLogin, error, onClose }: IpodLoginProps) {
  const { theme, clicker } = useIpodLook();

  const screen = (
    <Screen title="iPod">
      <Message icon="🎧" title="Music Translator">
        {error ? <>Login didn't work ({error}).<br /></> : null}
        Press the center button to connect Spotify
      </Message>
    </Screen>
  );

  const noop = () => {};

  return (
    <Ipod
      theme={theme}
      clicker={clicker}
      screen={screen}
      onMenu={noop}
      onPrev={noop}
      onNext={noop}
      onPlayPause={onLogin}
      onSelect={onLogin}
      onScroll={noop}
      onClose={onClose}
    />
  );
}

export default IpodLogin;
