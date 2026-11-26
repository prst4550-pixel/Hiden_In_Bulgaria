// Category-based curated local Bulgarian landmark backup photos
export const LOCAL_CATEGORY_FALLBACKS: Record<string, string> = {
  sanctuaries: '/places/belintash.jpg',
  fortresses: '/places/asenova-krepost.jpg',
  waterfalls: '/places/krushunski-vodopadi.jpg',
  caves: '/places/peshtera-prohodna.jpg',
  villages: '/places/kovachevitsa-village.jpg',
  monasteries: '/places/aladzha-manastir.jpg',
};

export function getFallbackImage(categoryId?: string, _title?: string): string {
  if (categoryId && LOCAL_CATEGORY_FALLBACKS[categoryId]) {
    return LOCAL_CATEGORY_FALLBACKS[categoryId];
  }
  return LOCAL_CATEGORY_FALLBACKS.sanctuaries;
}

// Inline SVG Data URI vector landscape placeholder (100% guaranteed to work offline or in sandbox)
export function createSvgDataUri(title: string = 'Скрито в България'): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1c1917" />
        <stop offset="50%" stop-color="#1b3b2b" />
        <stop offset="100%" stop-color="#0c0a09" />
      </linearGradient>
      <linearGradient id="mountains" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#b45309" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#1c1917" stop-opacity="0.9" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <!-- Mountain Silhouette -->
    <path d="M0,450 L200,320 L380,420 L600,260 L820,380 L1000,280 L1200,400 L1200,675 L0,675 Z" fill="url(#mountains)" />
    <path d="M0,520 L300,400 L550,480 L800,380 L1050,470 L1200,420 L1200,675 L0,675 Z" fill="#0f172a" opacity="0.8" />
    <!-- Sun/Compass Emblem -->
    <circle cx="600" cy="220" r="45" fill="#fef08a" opacity="0.15" />
    <circle cx="600" cy="220" r="30" fill="none" stroke="#fef08a" stroke-width="2" opacity="0.4" />
    <!-- Decorative Compass Star -->
    <path d="M600,185 L605,215 L635,220 L605,225 L600,255 L595,225 L565,220 L595,215 Z" fill="#d97706" opacity="0.8" />
    <!-- Text -->
    <text x="600" y="580" text-anchor="middle" fill="#fef08a" font-family="serif" font-size="28" font-weight="bold" letter-spacing="3">СКРИТО В БЪЛГАРИЯ</text>
    <text x="600" y="615" text-anchor="middle" fill="#a8a29e" font-family="sans-serif" font-size="18">${safeTitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  categoryId?: string,
  title?: string
) {
  const target = e.target as HTMLImageElement;
  const attempt = parseInt(target.dataset.fallbackAttempt || '0', 10);

  if (attempt === 0) {
    // Attempt 1: Try curated local Bulgarian landmark photo for that category (only if different from current src)
    const localBackup = getFallbackImage(categoryId, title);
    if (!target.src.endsWith(localBackup)) {
      target.dataset.fallbackAttempt = '1';
      target.src = localBackup;
      return;
    }
  }

  if (attempt <= 1) {
    // Attempt 2: Guaranteed inline SVG Data URI
    target.dataset.fallbackAttempt = '2';
    target.src = createSvgDataUri(title || target.alt || 'Скрито в България');
  } else {
    // Final stop to prevent infinite loops
    target.style.display = 'none';
  }
}
