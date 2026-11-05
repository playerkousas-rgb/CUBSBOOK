import React, { useEffect, useState } from 'react';

const listeners = new Set();
const currentRoute = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const emit = () => listeners.forEach((fn) => fn(currentRoute()));

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  emit();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function useFullLocation() {
  const [loc, setLoc] = useState(currentRoute);
  useEffect(() => {
    const fn = (next) => setLoc(next);
    listeners.add(fn);
    const onChange = () => setLoc(currentRoute());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return loc;
}

export function useRoute() {
  const loc = useFullLocation();
  return loc.split('?')[0].split('#')[0];
}

export function Link({ to, className, children, onClick, ...rest }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
