// Original stylized vector portrait generator. Builds a storybook-style silhouette
// portrait from a small trait object, entirely in SVG — no external art assets.

const SILHOUETTES = {
  slim: { shoulderW: 62, headR: 26, headY: 70, bodyTop: 96 },
  stout: { shoulderW: 82, headR: 28, headY: 74, bodyTop: 102 },
  tall: { shoulderW: 58, headR: 24, headY: 58, bodyTop: 84 },
  small: { shoulderW: 50, headR: 30, headY: 92, bodyTop: 122 },
};

function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) - amt, g = ((n >> 8) & 0xff) - amt, b = (n & 0xff) - amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function faceFeatures(cx, headY, headR, expression) {
  const eyeY = headY - 2;
  const eyeDX = headR * 0.42;
  const exp = expression || 'neutral';
  let browPath = '';
  let mouthPath = '';
  let eyeRy = 3.4;

  switch (exp) {
    case 'curious':
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 11} q 7 -5 14 -1 M ${cx + eyeDX - 7} ${eyeY - 13} q 7 -6 14 0`;
      mouthPath = `M ${cx - 7} ${headY + 14} q 7 4 14 0`;
      break;
    case 'worried':
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 8} q 7 3 14 5 M ${cx + eyeDX - 7} ${eyeY - 13} q 7 -3 14 -5`;
      mouthPath = `M ${cx - 7} ${headY + 16} q 7 -3 14 0`;
      break;
    case 'pleased':
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 10} q 7 -2 14 0 M ${cx + eyeDX - 7} ${eyeY - 10} q 7 -2 14 0`;
      mouthPath = `M ${cx - 8} ${headY + 12} q 8 8 16 0`;
      eyeRy = 2.6;
      break;
    case 'annoyed':
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 7} q 7 1 14 3 M ${cx + eyeDX - 7} ${eyeY - 10} q 7 -1 14 -3`;
      mouthPath = `M ${cx - 7} ${headY + 15} q 7 -2 14 -1`;
      break;
    case 'surprised':
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 13} q 7 -4 14 0 M ${cx + eyeDX - 7} ${eyeY - 13} q 7 -4 14 0`;
      mouthPath = `M ${cx - 4} ${headY + 12} a 4 5 0 1 0 8 0 a 4 5 0 1 0 -8 0`;
      eyeRy = 4.4;
      break;
    default: // neutral
      browPath = `M ${cx - eyeDX - 7} ${eyeY - 9} q 7 -1 14 0 M ${cx + eyeDX - 7} ${eyeY - 9} q 7 -1 14 0`;
      mouthPath = `M ${cx - 7} ${headY + 14} q 7 2 14 0`;
  }

  return `
    <ellipse cx="${cx - eyeDX}" cy="${eyeY}" rx="2.6" ry="${eyeRy}" fill="#2a2019"/>
    <ellipse cx="${cx + eyeDX}" cy="${eyeY}" rx="2.6" ry="${eyeRy}" fill="#2a2019"/>
    <path d="${browPath}" stroke="#2a2019" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="${mouthPath}" stroke="#5c3a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
  `;
}

function hairShape(type, cx, headY, headR, color) {
  const top = headY - headR;
  switch (type) {
    case 'long':
      return `<path d="M ${cx - headR - 2} ${headY - 6} q -6 40 0 74 q 8 6 16 0 q -6 -34 -2 -60 Z
                M ${cx + headR + 2} ${headY - 6} q 6 40 0 74 q -8 6 -16 0 q 6 -34 2 -60 Z
                M ${cx - headR} ${headY - 4} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR} -${headR * 0.9} -${headR * 2} 0 Z"
              fill="${color}"/>`;
    case 'hooded':
      return `<path d="M ${cx - headR - 12} ${headY + headR + 4}
                q -4 -${headR + 30} ${headR + 12} -${headR + 34}
                q ${headR + 12} 4 ${headR + 12} ${headR + 34}
                q -10 -14 -${headR + 12} -14
                q -${headR + 2} 0 -${headR + 12} 14 Z"
              fill="${color}"/>`;
    case 'bald':
      return `<ellipse cx="${cx - headR * 0.3}" cy="${top + headR * 0.5}" rx="${headR * 0.35}" ry="${headR * 0.18}" fill="#fff" opacity="0.18"/>`;
    case 'braided':
      return `<path d="M ${cx - headR} ${headY - 2} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR} -${headR} -${headR * 2} 0 Z" fill="${color}"/>
              <path d="M ${cx + headR - 4} ${headY} q 10 20 2 44 q 8 4 2 18" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case 'curly':
      return `<g fill="${color}">
                <circle cx="${cx - headR * 0.6}" cy="${top + 4}" r="${headR * 0.34}"/>
                <circle cx="${cx - headR * 0.05}" cy="${top - 3}" r="${headR * 0.38}"/>
                <circle cx="${cx + headR * 0.55}" cy="${top + 3}" r="${headR * 0.34}"/>
                <circle cx="${cx - headR * 0.85}" cy="${top + 16}" r="${headR * 0.26}"/>
                <circle cx="${cx + headR * 0.85}" cy="${top + 16}" r="${headR * 0.26}"/>
              </g>`;
    case 'bun':
      return `<path d="M ${cx - headR} ${headY - 2} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR} -${headR * 0.95} -${headR * 2} 0 Z" fill="${color}"/>
              <circle cx="${cx}" cy="${top - 6}" r="${headR * 0.28}" fill="${color}"/>`;
    default: // short
      return `<path d="M ${cx - headR} ${headY - 2} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR} -${headR * 1.05} -${headR * 2} 0 Z" fill="${color}"/>`;
  }
}

function propIcon(type, x, y, accent) {
  switch (type) {
    case 'satchel':
      return `<g transform="translate(${x},${y})"><rect x="-14" y="-4" width="28" height="20" rx="3" fill="${accent}" opacity="0.9"/><path d="M -10 -4 q 10 -14 20 0" stroke="${accent}" stroke-width="3" fill="none"/></g>`;
    case 'lute':
      return `<g transform="translate(${x},${y}) rotate(-18)"><ellipse cx="0" cy="10" rx="11" ry="14" fill="${accent}"/><rect x="-2.5" y="-16" width="5" height="26" rx="2" fill="${accent}"/></g>`;
    case 'cane':
      return `<g transform="translate(${x},${y})"><path d="M 0 -24 v 30" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><path d="M 0 -24 q 8 -4 8 4" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
    case 'compass':
      return `<g transform="translate(${x},${y})"><circle r="12" fill="none" stroke="${accent}" stroke-width="3"/><path d="M -5 5 L 0 -6 L 5 5 L 0 2 Z" fill="${accent}"/></g>`;
    case 'book':
      return `<g transform="translate(${x},${y})"><rect x="-13" y="-9" width="26" height="18" rx="2" fill="${accent}"/><line x1="0" y1="-9" x2="0" y2="9" stroke="#2a2019" stroke-width="1.5"/></g>`;
    default:
      return '';
  }
}

export function renderPortrait(portrait, expression = 'neutral', opts = {}) {
  const geo = SILHOUETTES[portrait.silhouette] || SILHOUETTES.slim;
  const cx = 110;
  const headY = geo.headY;
  const headR = geo.headR;
  const outfit = portrait.outfit || '#3c5a52';
  const outfitDark = darken(outfit, 30);
  const skin = portrait.skin || '#caa377';
  const hairColor = portrait.hairColor || '#3a2a1e';
  const accent = portrait.accent || '#c9a24b';

  const bodyPath = `M ${cx - geo.shoulderW} 240
     Q ${cx - geo.shoulderW} ${geo.bodyTop} ${cx - geo.shoulderW * 0.5} ${geo.bodyTop - 10}
     Q ${cx} ${geo.bodyTop - 20} ${cx + geo.shoulderW * 0.5} ${geo.bodyTop - 10}
     Q ${cx + geo.shoulderW} ${geo.bodyTop} ${cx + geo.shoulderW} 240 Z`;

  const showHood = portrait.hair === 'hooded';

  return `
  <svg viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="portrait" class="portrait-svg">
    <defs>
      <radialGradient id="pg-${portrait.outfit?.replace('#', '')}" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="rgba(255,214,153,0.16)"/>
        <stop offset="100%" stop-color="rgba(255,214,153,0)"/>
      </radialGradient>
    </defs>
    <circle cx="110" cy="110" r="118" fill="url(#pg-${portrait.outfit?.replace('#', '')})"/>
    ${!showHood ? `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="${skin}"/>` : ''}
    <path d="${bodyPath}" fill="${outfit}"/>
    <path d="M ${cx - geo.shoulderW} 240 Q ${cx - geo.shoulderW} ${geo.bodyTop} ${cx - geo.shoulderW * 0.5} ${geo.bodyTop - 10}" stroke="${outfitDark}" stroke-width="2" fill="none" opacity="0.5"/>
    ${showHood ? hairShape('hooded', cx, headY, headR, outfit) : ''}
    ${showHood ? `<circle cx="${cx}" cy="${headY + 4}" r="${headR * 0.92}" fill="${skin}"/>` : ''}
    ${faceFeatures(cx, headY, headR, expression)}
    ${!showHood ? hairShape(portrait.hair, cx, headY, headR, hairColor) : ''}
    ${portrait.prop && portrait.prop !== 'none' ? propIcon(portrait.prop, cx + geo.shoulderW - 6, 210, accent) : ''}
  </svg>`;
}
