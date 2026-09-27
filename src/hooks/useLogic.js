import { useLayoutEffect, useRef, useState } from 'react';

// Branche un contrôleur « à la classe » (état + méthodes + renderVals) sur les hooks React.
// - l'état vit dans useState ; setState(objet | fonction, rappel) fusionne comme avant ;
// - componentDidMount / componentDidUpdate / componentWillUnmount sont appelés depuis useLayoutEffect ;
// - les rappels de setState s'exécutent après l'affichage correspondant.
// Retourne [vue rendue, contrôleur].
export function useLogic(Logic, props) {
  const ctrl = useRef(null);
  const pending = useRef([]);
  const prev = useRef(null);

  const [state, setHostState] = useState(() => {
    const c = new Logic(props);
    ctrl.current = c;
    return c.state;
  });
  const c = ctrl.current;

  if (!c._hooked) {
    c._hooked = true;
    c.setState = (update, cb) => {
      setHostState(s => {
        const patch = typeof update === 'function' ? update(s, c.props) : update;
        return patch == null ? s : { ...s, ...patch };
      });
      if (cb) pending.current.push(cb);
    };
  }

  // Les méthodes et gestionnaires lisent toujours l'état et les props du dernier rendu.
  c.props = { ...c.props, ...props };
  c.state = state;

  useLayoutEffect(() => {
    c.componentDidMount?.();
    return () => c.componentWillUnmount?.();
  }, [c]);

  useLayoutEffect(() => {
    if (prev.current && prev.current.state !== state) c.componentDidUpdate?.(prev.current.props, prev.current.state);
    prev.current = { props: c.props, state };
    pending.current.splice(0).forEach(cb => cb());
  });

  return [c.render(), c];
}
