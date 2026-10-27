import { api } from './api';

export const fmtNum = (n) =>
  new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(n || 0);

// "12 Окт" style, like in the design
export function fmtDate(value) {
  const d = new Date(value);
  if (!value || isNaN(d)) return '';
  const s = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  const [day, month = ''] = s.split(' ');
  return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`.trim();
}

export const openLink = (url) => {
  api?.openExternal(url).catch(() => {});
};

// Stone Golem art goes to /public/hero.jpg; gradients are the fallback.
export const heroStyle = {
  backgroundImage: [
    'radial-gradient(ellipse at 50% 85%, rgba(255,77,0,0.45) 0%, transparent 55%)',
    'radial-gradient(ellipse at 50% 35%, rgba(60,50,50,0.55) 0%, transparent 60%)',
    'url(./hero.jpg)',
  ].join(','),
};
