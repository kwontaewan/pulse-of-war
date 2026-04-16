// Leaflet 2D world map + CSS pulse animation

export function initMap(container, conflicts, onConflictClick) {
  const isMobile = window.innerWidth < 768;

  const map = L.map(container, {
    center: [20, 20],
    zoom: isMobile ? 1.5 : 2.5,
    minZoom: 1.5,
    maxZoom: 8,
    zoomControl: false,
    attributionControl: false,
    worldCopyJump: true,
    maxBounds: [[-85, -Infinity], [85, Infinity]],
    maxBoundsViscosity: 0.8
  });

  // Dark tile layer (CartoDB Dark Matter — free, no API key)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Country labels layer (subtle)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    opacity: 0.4
  }).addTo(map);

  const maxCasualties = Math.max(...conflicts.map(c => c.casualties));

  // Add conflict markers
  const markers = [];
  conflicts.forEach(c => {
    const isFeatured = c.featured === true;
    const size = isFeatured ? 56 : mapRange(c.casualties, 0, maxCasualties, 12, 48);
    const pulseSpeed = isFeatured ? 1.0 : mapRange(c.casualties, 0, maxCasualties, 3, 1.2);
    const dotClass = isFeatured ? 'pulse-dot pulse-dot--featured' : 'pulse-dot';
    const labelClass = isFeatured ? 'pulse-label pulse-label--featured' : 'pulse-label';
    const ringClass = isFeatured ? 'pulse-ring pulse-ring--featured' : 'pulse-ring';

    // Pulse ring (CSS animated div)
    const pulseIcon = L.divIcon({
      className: 'pulse-marker-wrapper',
      html: `
        <div class="${ringClass}" style="
          width: ${size * 3}px;
          height: ${size * 3}px;
          animation-duration: ${pulseSpeed}s;
        "></div>
        <div class="${ringClass} pulse-ring--delayed" style="
          width: ${size * 3}px;
          height: ${size * 3}px;
          animation-duration: ${pulseSpeed}s;
          animation-delay: ${pulseSpeed / 2}s;
        "></div>
        <div class="${dotClass}" style="
          width: ${size}px;
          height: ${size}px;
        "></div>
        <div class="${labelClass}">${shortName(c.name)}${isFeatured ? ' ⚠' : ''}</div>
      `,
      iconSize: [size * 3, size * 3],
      iconAnchor: [size * 1.5, size * 1.5]
    });

    const marker = L.marker([c.lat, c.lng], { icon: pulseIcon })
      .addTo(map)
      .on('click', () => onConflictClick(c));

    markers.push({ marker, conflict: c });
  });

  // Connection lines between conflicts sharing parties
  const arcs = buildArcs(conflicts);
  arcs.forEach(arc => {
    L.polyline(
      [[arc.startLat, arc.startLng], [arc.endLat, arc.endLng]],
      {
        color: 'rgba(255, 32, 32, 0.15)',
        weight: 1,
        dashArray: '6 4',
        interactive: false
      }
    ).addTo(map);
  });

  // Zoom controls (bottom-right, out of the way)
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return map;
}

export function flyTo(map, conflict) {
  map.flyTo([conflict.lat, conflict.lng], 5, { duration: 1.5 });
}

function shortName(name) {
  return name
    .replace(/ - .*/, '')
    .replace(/ War$/, '')
    .replace(/ Civil$/, '')
    .replace(/ Insurgency$/, '');
}

function buildArcs(conflicts) {
  const arcs = [];
  for (let i = 0; i < conflicts.length; i++) {
    for (let j = i + 1; j < conflicts.length; j++) {
      const shared = conflicts[i].parties.filter(p =>
        conflicts[j].parties.includes(p)
      );
      if (shared.length > 0) {
        arcs.push({
          startLat: conflicts[i].lat,
          startLng: conflicts[i].lng,
          endLat: conflicts[j].lat,
          endLng: conflicts[j].lng
        });
      }
    }
  }
  return arcs;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
