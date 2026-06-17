const CAPE_CORAL_CENTER = [26.5629, -81.9495];
let canalLayer;
let allFeatures = [];
let activeFilter = 'ALL';
let marker;

const map = L.map('map', { scrollWheelZoom: true }).setView(CAPE_CORAL_CENTER, 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function canalColor(waterType) {
  const type = (waterType || '').toUpperCase();
  if (type.includes('FRESH')) return getComputedStyle(document.documentElement).getPropertyValue('--fresh').trim();
  if (type.includes('SALT')) return getComputedStyle(document.documentElement).getPropertyValue('--salt').trim();
  return '#6b7280';
}

function canalStyle(feature) {
  return {
    color: canalColor(feature.properties.WATER_TYPE),
    weight: 1.5,
    opacity: 0.85,
    fillColor: canalColor(feature.properties.WATER_TYPE),
    fillOpacity: 0.35
  };
}

function selectedStyle(layer) {
  canalLayer.resetStyle();
  layer.setStyle({ color: '#f4a261', fillColor: '#f4a261', weight: 3, fillOpacity: 0.62 });
  layer.bringToFront();
}

function popupHtml(props) {
  const name = props.NAME || 'Unnamed Canal';
  const water = props.WATER_TYPE || 'Verify';
  const nav = props.NAV_SYST || 'Verify';
  const basin = props.Basin || 'Verify';
  return `
    <div class="popup-title">${name}</div>
    <div class="popup-row"><strong>Water Type:</strong> ${water}</div>
    <div class="popup-row"><strong>Navigation System:</strong> ${nav}</div>
    <div class="popup-row"><strong>Basin:</strong> ${basin}</div>
    <hr>
    <div class="popup-row">Want help reviewing a property on this canal?</div>
    <a href="mailto:melodiehagopian@gmail.com?subject=Waterway%20Review%20-%20${encodeURIComponent(name)}">Request a Waterway Review</a>
  `;
}

function featureMatchesFilter(feature) {
  if (activeFilter === 'ALL') return true;
  return String(feature.properties.WATER_TYPE || '').toUpperCase().includes(activeFilter);
}

function renderCanals() {
  if (canalLayer) canalLayer.remove();
  const filtered = {
    type: 'FeatureCollection',
    features: allFeatures.filter(featureMatchesFilter)
  };
  canalLayer = L.geoJSON(filtered, {
    style: canalStyle,
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHtml(feature.properties));
      layer.on('click', () => selectedStyle(layer));
    }
  }).addTo(map);
}

fetch('Canals.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Canals.geojson could not be loaded.');
    return response.json();
  })
  .then(data => {
    allFeatures = data.features || [];
    renderCanals();
    if (canalLayer.getBounds && canalLayer.getBounds().isValid()) {
      map.fitBounds(canalLayer.getBounds(), { padding: [20, 20] });
    }
  })
  .catch(error => {
    console.error(error);
    alert('The canal map data could not be loaded. Make sure Canals.geojson is in the same folder as this page.');
  });

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    activeFilter = button.dataset.filter;
    renderCanals();
  });
});

function findCanal() {
  const query = document.getElementById('canalSearch').value.trim().toUpperCase();
  if (!query) return;
  let foundLayer = null;
  canalLayer.eachLayer(layer => {
    const name = String(layer.feature.properties.NAME || '').toUpperCase();
    if (!foundLayer && name.includes(query)) foundLayer = layer;
  });
  if (!foundLayer) {
    alert('No matching canal found. Try a shorter name, like Rubicon or Mohawk.');
    return;
  }
  map.fitBounds(foundLayer.getBounds(), { padding: [40, 40], maxZoom: 15 });
  selectedStyle(foundLayer);
  foundLayer.openPopup();
}

document.getElementById('canalBtn').addEventListener('click', findCanal);
document.getElementById('canalSearch').addEventListener('keydown', e => { if (e.key === 'Enter') findCanal(); });

async function searchAddress() {
  const raw = document.getElementById('addressSearch').value.trim();
  if (!raw) return;
  const query = raw.toLowerCase().includes('cape coral') ? raw : `${raw}, Cape Coral, FL`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const results = await response.json();
    if (!results.length) {
      alert('Address not found. Try adding Cape Coral, FL or check the spelling.');
      return;
    }
    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (marker) marker.remove();
    marker = L.marker([lat, lon]).addTo(map).bindPopup(`<strong>${raw}</strong><br>Verify canal details before purchasing.`).openPopup();
    map.setView([lat, lon], 16);
  } catch (error) {
    console.error(error);
    alert('Address search is temporarily unavailable. Try searching by canal name.');
  }
}

document.getElementById('addressBtn').addEventListener('click', searchAddress);
document.getElementById('addressSearch').addEventListener('keydown', e => { if (e.key === 'Enter') searchAddress(); });
