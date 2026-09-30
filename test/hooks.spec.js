// @vitest-environment jsdom
import 'fake-indexeddb/auto';
// Hooks React : adaptateur useLogic, sauvegarde locale et application complète dans un DOM simulé.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useLogic } from '../src/hooks/useLogic.js';
import App from '../src/app/App.jsx';
import BtpLogic from '../src/app/logic.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollTo ??= function () {}; // absent de jsdom

const mount = el => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
};

describe('useLogic', () => {
  class Counter {
    state = { n: 0, other: 'x' };
    log = [];
    constructor(props) { this.props = props; }
    componentDidMount() { this.log.push('mount'); }
    componentDidUpdate(pp, ps) { this.log.push('update ' + ps.n + '→' + this.state.n); }
    componentWillUnmount() { this.log.push('unmount'); }
    render() { return React.createElement('b', null, `${this.state.n}${this.state.other}${this.props.suffix}`); }
  }
  let ctrl;
  function Host(p) { const [view, c] = useLogic(Counter, p); ctrl = c; return view; }

  it('fusionne l\'état, exécute les rappels et le cycle de vie', () => {
    const { host, unmount } = mount(React.createElement(Host, { suffix: '!' }));
    expect(host.textContent).toBe('0x!');
    const cb = vi.fn(() => ctrl.state.n);
    act(() => ctrl.setState({ n: 1 }, cb));
    act(() => ctrl.setState(s => ({ n: s.n + 1 })));
    expect(host.textContent).toBe('2x!');
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.results[0].value).toBe(1);          // le rappel voit l'état déjà appliqué
    unmount();
    expect(ctrl.log).toEqual(['mount', 'update 0→1', 'update 1→2', 'unmount']);
  });
});

describe('App', () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });

  it('restaure la sauvegarde locale en ignorant les clés inattendues', async () => {
    localStorage.setItem(BtpLogic.KEY, JSON.stringify({ client: 'Mme Test', tab: 'set', toast: 'piège' }));
    const { host, unmount } = mount(React.createElement(App));
    await act(() => new Promise(r => setTimeout(r, 50)));   // restauration asynchrone
    expect(host.querySelector('[data-screen-label="01 Accueil"]')).not.toBeNull(); // « tab » non restauré
    act(() => host.querySelectorAll('nav button')[1].click());
    expect([...host.querySelectorAll('input')].some(i => i.value === 'Mme Test')).toBe(true);
    unmount();
  });

  it('enregistre les changements après 400 ms', async () => {
    vi.useFakeTimers();
    const { host, unmount } = mount(React.createElement(App));
    act(() => host.querySelectorAll('nav button')[1].click());
    const input = [...host.querySelectorAll('input')].find(i => i.value === 'M. et Mme Payet');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    act(() => { set.call(input, 'SCI Nouveau'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(() => vi.advanceTimersByTimeAsync(450));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(BtpLogic.KEY)).client).toBe('SCI Nouveau'));
    unmount();
  });

  it('Échap ferme l\'aide de saisie', () => {
    const { host, unmount } = mount(React.createElement(App));
    act(() => host.querySelectorAll('nav button')[4].click());
    const help = host.querySelector('button[aria-label="Où trouver cette information ?"]');
    act(() => help.click());
    expect(host.querySelector('[data-screen-label="Aide saisie"]')).not.toBeNull();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[data-screen-label="Aide saisie"]')).toBeNull();
    unmount();
  });
});
