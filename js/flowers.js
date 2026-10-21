// Рисует букет в SVG по цветам из каталога. Одинаковый id даёт одинаковый рисунок.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).flowers = mod;
})(typeof self !== "undefined" ? self : this, function () {
  function rng(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function bloom(x, y, r, color, center, rand) {
    const n = 5 + Math.floor(rand() * 4);
    const turn = rand() * 360;
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = turn + (360 / n) * i;
      out += `<ellipse cx="${x}" cy="${(y - r * 0.55).toFixed(1)}" rx="${(r * 0.42).toFixed(1)}" ry="${(r * 0.6).toFixed(1)}" fill="${color}" transform="rotate(${a.toFixed(1)} ${x} ${y})"/>`;
    }
    return out + `<circle cx="${x}" cy="${y}" r="${(r * 0.28).toFixed(1)}" fill="${center}"/>`;
  }

  function bouquetSVG(product, label) {
    const rand = rng(product.id);
    const W = 320, H = 360, cx = 160, tie = 270;
    const blooms = [];
    const count = 9 + Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i / (count - 1))) + (rand() - 0.5) * 0.25;
      const dist = 40 + rand() * 75;
      blooms.push({
        x: +(cx - Math.cos(a) * dist * 1.25).toFixed(1),
        y: +(150 - Math.sin(a) * dist * 0.9 + rand() * 30).toFixed(1),
        r: 22 + rand() * 16,
        color: product.colors[i % product.colors.length],
      });
    }
    blooms.sort((a, b) => a.y - b.y);

    let stems = "", leaves = "", heads = "";
    for (const b of blooms) {
      stems += `<path d="M${b.x} ${b.y} Q${((b.x + cx) / 2).toFixed(1)} ${(b.y + tie) / 2} ${cx} ${tie}" stroke="#4f7a45" stroke-width="3" fill="none"/>`;
      if (rand() > 0.45) {
        const lx = (b.x + cx) / 2, ly = (b.y + tie) / 2 + 10;
        leaves += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="9" ry="24" fill="${rand() > 0.5 ? "#6f9a5c" : "#3f6b3a"}" transform="rotate(${((b.x - cx) * 0.5).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})"/>`;
      }
      heads += bloom(b.x, b.y, b.r, b.color, product.center, rand);
    }
    const wrap = `<path d="M${cx - 92} 196 L${cx} ${H - 8} L${cx + 92} 196 L${cx + 54} 214 L${cx} 300 L${cx - 54} 214 Z" fill="#d9b48a"/><path d="M${cx - 54} 214 L${cx} 300 L${cx + 54} 214 L${cx} 236 Z" fill="#c69a6c"/>`;
    const ribbon = `<path d="M${cx - 22} ${tie} q22 -14 44 0 q-22 14 -44 0z" fill="#2b1d33"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label || product.name}" xmlns="http://www.w3.org/2000/svg">${stems}${leaves}${heads}${wrap}${ribbon}</svg>`;
  }

  return { bouquetSVG };
});
