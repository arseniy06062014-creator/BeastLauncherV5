import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const cache = new Map();

// Skins are fetched by the main process (Ely.by skin system) and cached here.
export function loadSkin(nick) {
  const key = nick.toLowerCase();
  if (!cache.has(key)) {
    const p = api
      .getSkin(nick)
      .then(async (d) => {
        if (!d.found) return { found: false };
        return { found: true, img: await loadImage(d.dataUrl), slim: d.model === 'slim' };
      })
      .catch(() => {
        cache.delete(key);
        return { found: false, error: true };
      });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function useSkin(nick) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    if (!nick || !api) {
      setState({ loading: false, found: false });
      return undefined;
    }
    setState({ loading: true });
    loadSkin(nick).then((r) => alive && setState({ loading: false, ...r }));
    return () => {
      alive = false;
    };
  }, [nick]);
  return state;
}

export function SkinHead({ nick, size = 40 }) {
  const ref = useRef(null);
  const skin = useSkin(nick);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    if (skin.found) {
      ctx.drawImage(skin.img, 8, 8, 8, 8, 0, 0, c.width, c.height);
      ctx.drawImage(skin.img, 40, 8, 8, 8, 0, 0, c.width, c.height);
    }
  }, [skin]);

  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className="rounded-full border border-cyan-300/40 bg-cyan-500/20"
    />
  );
}

// 64x64 (and legacy 64x32) skin layout → flat front/back figure
const HEAD = { front: [8, 8], back: [24, 8] };
const HAT = { front: [40, 8], back: [56, 8] };
const BODY = { front: [20, 20], back: [32, 20] };
const JACKET = { front: [20, 36], back: [32, 36] };

export function SkinFigure({ skin, back = false, scale = 10 }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !skin?.found) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;

    const img = skin.img;
    const legacy = img.height < 64;
    const view = back ? 'back' : 'front';
    const aw = skin.slim ? 3 : 4;
    const backOff = skin.slim ? 7 : 8;

    const part = (sx, sy, w, h, dx, dy, flip = false) => {
      ctx.save();
      if (flip) {
        ctx.translate((dx + w) * scale, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, w, h, 0, dy * scale, w * scale, h * scale);
      } else {
        ctx.drawImage(img, sx, sy, w, h, dx * scale, dy * scale, w * scale, h * scale);
      }
      ctx.restore();
    };

    const armSrc = (left, overlay) => {
      let fx;
      let y;
      if (!left) {
        fx = 44;
        y = overlay ? 36 : 20;
      } else {
        fx = overlay ? 52 : 36;
        y = 52;
      }
      return [view === 'front' ? fx : fx + backOff, y];
    };
    const legSrc = (left, overlay) => {
      let fx;
      let y;
      if (!left) {
        fx = 4;
        y = overlay ? 36 : 20;
      } else {
        fx = overlay ? 4 : 20;
        y = 52;
      }
      return [view === 'front' ? fx : fx + 8, y];
    };

    // Character's right limb appears on the viewer's left in the front view, and vice versa from behind.
    const viewerLeftIsRight = !back;
    const limbs = [
      { left: !viewerLeftIsRight, armX: 4 - aw, legX: 4 },
      { left: viewerLeftIsRight, armX: 12, legX: 8 },
    ];

    // base layer
    part(...HEAD[view], 8, 8, 4, 0);
    part(...BODY[view], 8, 12, 4, 8);
    for (const l of limbs) {
      if (legacy && l.left) {
        // old skins: left limbs are mirrored right limbs
        part(...armSrc(false, false), aw, 12, l.armX, 8, true);
        part(...legSrc(false, false), 4, 12, l.legX, 20, true);
      } else {
        part(...armSrc(l.left, false), aw, 12, l.armX, 8);
        part(...legSrc(l.left, false), 4, 12, l.legX, 20);
      }
    }
    // overlay layer (hat, jacket, sleeves, pants)
    part(...HAT[view], 8, 8, 4, 0);
    if (!legacy) {
      part(...JACKET[view], 8, 12, 4, 8);
      for (const l of limbs) {
        part(...armSrc(l.left, true), aw, 12, l.armX, 8);
        part(...legSrc(l.left, true), 4, 12, l.legX, 20);
      }
    }
  }, [skin, back, scale]);

  return (
    <canvas
      ref={ref}
      width={16 * scale}
      height={32 * scale}
      style={{ imageRendering: 'pixelated' }}
      className="drop-shadow-[0_0_24px_rgba(255,90,0,0.35)]"
    />
  );
}
