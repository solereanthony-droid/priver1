import BtpLogic from './logic.js';
import { useLogic } from '../hooks/useLogic.js';
import { usePersistence } from '../hooks/usePersistence.js';
import { useServiceWorker } from '../hooks/useServiceWorker.js';
import { usePaBridge } from '../hooks/usePaBridge.js';

// Application : la logique métier du prototype (BtpLogic) branchée sur des hooks React.
// Le prototype gère lui-même Échap, la mise à l'échelle, le thème et l'état du réseau (componentDidMount).
export default function App({ regime = 'assujetti', acompte = 30, paName = 'FactuPro 974' }) {
  const [view, logic] = useLogic(BtpLogic, { regime, acompte, paName });
  usePersistence(BtpLogic.KEY, logic.state, {
    snapshot: s => logic.snapshot(s),
    restore: d => logic.restore(d),
    onError: () => logic.flash('Stockage plein : les dernières modifications ne sont pas enregistrées. Supprime un plan importé.'),
  });
  useServiceWorker();
  usePaBridge(logic, !!logic.state.locked);
  return view;
}
