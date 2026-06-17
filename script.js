const DATA_URL = 'Canals.geojson';
const CONTACT_URL = 'https://livelatitude26.com/content/cape-coral-waterway-gulf-access-guide';
const CAPE_CORAL = [26.642, -81.997];

let map;
let canalLayer;
let labelLayer;
let geojsonData;
let selectedLayer = null;
let allFeatures = [];

const els = {
  stats: document.getElementById('mapStats'),
  selectedName: document.getElementById('selectedName'),
  selectedType: document.getElementById('selectedType'),
  selectedNav: document.getElementById('selectedNav'),
  selectedBasin: document.getElementById('selectedBasin'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  showSalt: document.getElementById('showSalt'),
  showFresh: document.getElementById('showFresh'),
  showLabels: document.getElementById('showLabels'),
  resetBtn: document.getElementById('resetBtn'),
  reviewBtn: document.getElementById('reviewBtn')
};

function waterType(props) {
  const t = String(props.WATER_TYPE || '').toUpperCase();
  return t.includes('FRESH') ? 'FRESH' : 'SALT';
}

function waterLabel(props) {
  return waterType(props) === 'FRESH' ? 'Freshwater' : 'Saltwater / Gulf Access System';
}

function getStyle(feature) {
  const type = waterType(feature.properties || {});
  const showSalt = els.showSalt.checked;
  const showFresh = els.showFresh.checked;
  const visible = (type === 'SALT' && showSalt) || (type === 'FRESH' && showFresh);

  return {
    color: type === 'FRESH' ? '#2f80ed' : '#06a6a6',
    weight: visible ? 2.5 : 0,
    opacity: visible ? 0.9 : 0,
    fillColor: type === 'FRESH' ? '#2f80ed' : '#06a6a6',
    fillOpacity: visible ? 0.13 : 0,
    interactive: visible
  };
}

function selectedStyle() {
  return {
    color: '#f2ae2e',
    weight: 5,
    opacity: 1,
    fillColor: '#f2ae2e',
    fillOpacity: 0.23
  };
}

function popupHtml(props) {
  const name = props.NAME || 'Unnamed Waterway';
  const nav = props.NAV_SYST || 'Not listed';
  const basin = props.Basin || 'Not listed';

  return `
    <div class="popup-title">${escapeHtml(name)}</div>
    <span class="popup-badge">${escapeHtml(waterLabel(props))}</span>
    <div class="popup-grid">
      <div class="popup-row"><span>Navigation System</span><strong>${escapeHtml(nav)}</strong></div>
      <div class="popup-row"><span>Basin</span><strong>${escapeHtml(basin)}</strong></div>
    </div>
    <a class="popup-cta" href="${CONTACT_URL}" target="_blank" rel="noopener">Ask Latitude 26° about this waterway</a>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[ch]));
}

function selectFeature(layer, feature) {
  if (selectedLayer && selectedLayer !== layer) {
    canalLayer.resetStyle(selectedLayer);
  }

  selectedLayer = layer;
  layer.setStyle(selectedStyle());

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  const p = feature.properties || {};
  els.selectedName.textContent = p.NAME || 'Unnamed Waterway';
  els.selectedType.textContent = waterLabel(p);
  els.selectedNav.textContent = p.NAV_SYST || 'Not listed';
  els.selectedBasin.textContent = p.Basin || 'Not listed';
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};

  allFeatures.push({
    name: props.NAME || 'Unnamed Waterway',
    feature,
    layer
  });

  layer.bindPopup(popupHtml(props));

  layer.on({
    click: () => selectFeature(layer, feature),
    mouseover: () => {
      if (layer !== selectedLayer) {
        layer.setStyle({ weight: 4, fillOpacity: 0.22 });
      }
    },
    mouseout: () => {
      if (layer !== selectedLayer) {
        canalLayer.resetStyle(layer);
      }
    }
  });
}

function buildLabels() {
  if (labelLayer) {
    labelLayer.remove();
  }

  labelLayer = L.layerGroup();

  if (!els.showLabels.checked) {
    return;
  }

  allFeatures.forEach(item => {
    const p = item.feature.properties || {};

    if (!p.NAME) {
      return;
    }

    const type = waterType(p);

    if ((type === 'SALT' && !els.showSalt.checked) || (type === 'FRESH' && !els.showFresh.checked)) {
      return;
    }

    try {
      const c = item.layer.getBounds().getCenter();
      const marker = L.marker(c, {
        icon: L.divIcon({
          className: 'canal-label',
          html: escapeHtml(p.NAME),
          iconSize: null
        }),
        interactive: false
      });

      labelLayer.addLayer(marker);
    } catch (e) {}
  });

  labelLayer.addTo(map);
}

function refreshFilters() {
  if (!canalLayer) {
    return;
  }

  selectedLayer = null;
  canalLayer.setStyle(getStyle);
  buildLabels();
}

function showSearchResults(matches) {
  els.searchResults.innerHTML = '';

  if (!matches.length) {
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = '<div class="result-btn">No canal matches. Try a full Cape Coral address.</div>';
    return;
  }

  els.searchResults.hidden = false;

  matches.slice(0, 10).forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'result-btn';
    b.textContent = item.name;

    b.addEventListener('click', () => {
      els.searchResults.hidden = true;
      selectFeature(item.layer, item.feature);
      item.layer.openPopup();
      map.fitBounds(item.layer.getBounds(), {
        padding: [60, 60],
        maxZoom: 15
      });
    });

    els.searchResults.appendChild(b);
  });
}

async function searchAddress(query) {
  els.searchResults.hidden = false;
  els.searchResults.innerHTML = '<div class="result-btn">Searching address…</div>';

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=us&q=${encodeURIComponent(query + ', Cape Coral, FL')}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  const data = await res.json();
  els.searchResults.innerHTML = '';

  if (!data.length) {
    els.searchResults.innerHTML = '<div class="result-btn">No address found. Try adding Cape Coral, FL.</div>';
    return;
  }

  data.forEach(place => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'result-btn';
    b.textContent = place.display_name;

    b.addEventListener('click', () => {
      els.searchResults.hidden = true;

      const lat = Number(place.lat);
      const lon = Number(place.lon);

      L.marker([lat, lon])
        .addTo(map)
        .bindPopup('<strong>Address search result</strong><br>' + escapeHtml(place.display_name))
        .openPopup();

      map.setView([lat, lon], 16);
    });

    els.searchResults.appendChild(b);
  });
}

async function doSearch() {
  const q = els.searchInput.value.trim();

  if (!q) {
    return;
  }

  const qUpper = q.toUpperCase();
  const matches = allFeatures.filter(item => item.name.toUpperCase().includes(qUpper));

  if (matches.length) {
    showSearchResults(matches);
  } else {
    await searchAddress(q);
  }
}

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    preferCanvas: true
  }).setView(CAPE_CORAL, 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 250);
  setTimeout(() => map.invalidateSize(), 1000);

  window.addEventListener('resize', () => {
    map.invalidateSize();
  });
}

async function loadData() {
  const loading = L.DomUtil.create('div', 'loading');
  loading.textContent = 'Loading Cape Coral waterways…';
  document.body.appendChild(loading);

  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    geojsonData = await res.json();
    allFeatures = [];

    canalLayer = L.geoJSON(geojsonData, {
      style: getStyle,
      onEachFeature
    }).addTo(map);

    map.fitBounds(canalLayer.getBounds(), {
      padding: [30, 30]
    });

    const total = geojsonData.features.length;
    const fresh = geojsonData.features.filter(f => waterType(f.properties || {}) === 'FRESH').length;
    const salt = total - fresh;

    els.stats.textContent = `${total.toLocaleString()} waterways shown • ${salt} saltwater / Gulf access • ${fresh} freshwater`;

    buildLabels();
  } catch (err) {
    console.error(err);
    els.stats.textContent = 'Waterway data could not be loaded';
  } finally {
    loading.remove();
    setTimeout(() => map.invalidateSize(), 350);
    setTimeout(() => map.invalidateSize(), 1200);
  }
}

function bindEvents() {
  els.searchBtn.addEventListener('click', doSearch);

  els.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      doSearch();
    }
  });

  els.searchInput.addEventListener('input', () => {
    const q = els.searchInput.value.trim().toUpperCase();

    if (q.length < 2) {
      els.searchResults.hidden = true;
      return;
    }

    const matches = allFeatures.filter(item => item.name.toUpperCase().includes(q));

    if (matches.length) {
      showSearchResults(matches);
    }
  });

  [els.showSalt, els.showFresh, els.showLabels].forEach(el => {
    el.addEventListener('change', refreshFilters);
  });

  els.resetBtn.addEventListener('click', () => {
    els.showSalt.checked = true;
    els.showFresh.checked = true;
    els.showLabels.checked = false;
    els.searchInput.value = '';
    els.searchResults.hidden = true;

    refreshFilters();

    if (canalLayer) {
      map.fitBounds(canalLayer.getBounds(), {
        padding: [30, 30]
      });
    }
  });

  els.reviewBtn.addEventListener('click', () => {
    window.open(CONTACT_URL, '_blank');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  bindEvents();
  await loadData();
});
