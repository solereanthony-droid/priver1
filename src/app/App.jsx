import { useEffect } from 'react';
import BtpLogic from './logic.js';
import { useLogic } from '../hooks/useLogic.js';
import { usePersistence } from '../hooks/usePersistence.js';
import { useFitScale } from '../hooks/useFitScale.js';
import { useEscapeKey } from '../hooks/useEscapeKey.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

// Application : la logique métier du prototype (BtpLogic) branchée sur des hooks React.
export default function App({ regime = 'assujetti', acompte = 30, paName = 'FactuPro 974' }) {
  const online = useOnlineStatus();
  const [view, logic] = useLogic(BtpLogic, { regime, acompte, paName, online });

  usePersistence(BtpLogic.KEY, logic.state, { snapshot: s => logic.snapshot(s), restore: d => logic.restore(d) });
  useEscapeKey(() => logic.onEscape());

  const fitK = useFitScale();
  useEffect(() => { if (logic.state.fitK !== fitK) logic.setState({ fitK }); }, [fitK, logic]);

  return view;
}
