const CAPE_CORAL_CENTER = [26.6298, -81.9953];
const map = L.map('map', { zoomControl: false }).setView(CAPE_CORAL_CENTER, 12);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let canalLayer;
let labelLayer = L.layerGroup().addTo(map);
let selectedLayer = null;
let geoData = null;
let searchMarker = null;

const showSalt = document.getElementById('showSalt');
const showFresh = document.getElementById('showFresh');
const showLabels = document.getElementById('showLabels');
const countText = document.getElementById('countText');
const searchStatus = document.getElementById('searchStatus');

function waterTypeLabel(value){
  if(!value) return 'Unknown';
  if(String(value).toUpperCase()==='SALT') return 'Saltwater / Gulf Access System';
  if(String(value).toUpperCase()==='FRESH') return 'Freshwater System';
  return value;
}

function styleFeature(feature){
  const type = String(feature.properties?.WATER_TYPE || '').toUpperCase();
  const isSalt = type === 'SALT';
  return {
    color: isSalt ? '#09a79d' : '#2e86de',
    weight: 2.25,
    opacity: .9,
    fillColor: isSalt ? '#09a79d' : '#2e86de',
    fillOpacity: .22
  };
}

function filterFeature(feature){
  const type = String(feature.properties?.WATER_TYPE || '').toUpperCase();
  if(type === 'SALT' && !showSalt.checked) return false;
  if(type === 'FRESH' && !showFresh.checked) return false;
  return true;
}

function popupHtml(props){
  const name = props.NAME || 'Unnamed Canal';
  const subject = encodeURIComponent(`Waterway question: ${name}`);
  return `<div class="popup-title">${name}</div>
    <div class="popup-line"><strong>Water Type:</strong> ${waterTypeLabel(props.WATER_TYPE)}</div>
    <div class="popup-line"><strong>Navigation System:</strong> ${props.NAV_SYST || 'Verify'}</div>
    <div class="popup-line"><strong>Basin:</strong> ${props.Basin || 'Verify'}</div>
    <a class="popup-btn" href="https://livelatitude26.com/contact?subject=${subject}" target="_blank" rel="noopener">Ask About This Waterway</a>`;
}

function updateReport(props){
  const name = props.NAME || 'Unnamed Canal';
  document.getElementById('canalName').textContent = name;
  document.getElementById('waterType').textContent = waterTypeLabel(props.WATER_TYPE);
  document.getElementById('navSystem').textContent = props.NAV_SYST || 'Verify';
  document.getElementById('basin').textContent = props.Basin || 'Verify';
  document.getElementById('canalNote').textContent = `${name} is shown from Cape Coral canal GIS data. Before relying on this for a purchase, verify the exact route, bridge clearances, depth, dock/lift details, and boating suitability for your specific vessel.`;
  document.getElementById('askLink').href = `https://livelatitude26.com/contact?subject=${encodeURIComponent('Waterway question: ' + name)}`;
}

function onEachFeature(feature, layer){
  const props = feature.properties || {};
  layer.bindPopup(popupHtml(props));
  layer.on('click', () => {
    if(selectedLayer) canalLayer.resetStyle(selectedLayer);
    selectedLayer = layer;
    layer.setStyle({ color:'#f6b73c', weight:5, opacity:1, fillOpacity:.36 });
    layer.bringToFront();
    updateReport(props);
  });
}

function addLabels(){
  labelLayer.clearLayers();
  if(!showLabels.checked || !geoData) return;
  geoData.features.forEach(feature => {
    if(!filterFeature(feature)) return;
    const props = feature.properties || {};
    const name = props.NAME;
    if(!name || !feature.geometry) return;
    try{
      const temp = L.geoJSON(feature);
      const center = temp.getBounds().getCenter();
      L.marker(center, {
        interactive:false,
        icon:L.divIcon({ className:'canal-label', html:name.replace(' CANAL',''), iconSize:null })
      }).addTo(labelLayer);
    }catch(e){}
  });
}

function renderLayer(){
  if(canalLayer) map.removeLayer(canalLayer);
  selectedLayer = null;
  canalLayer = L.geoJSON(geoData, { style: styleFeature, filter: filterFeature, onEachFeature }).addTo(map);
  const visible = geoData.features.filter(filterFeature).length;
  countText.textContent = `${visible.toLocaleString()} waterways shown`;
  if(visible){ map.fitBounds(canalLayer.getBounds(), { padding:[25,25] }); }
  addLabels();
}

async function loadCanals(){
  try{
    const res = await fetch('Canals.geojson');
    if(!res.ok) throw new Error('Could not load canal data');
    geoData = await res.json();
    renderLayer();
  }catch(error){
    countText.textContent = 'Map data could not load';
    console.error(error);
  }
}

async function searchAddress(){
  const query = document.getElementById('addressSearch').value.trim();
  if(!query){ searchStatus.textContent = 'Enter a Cape Coral address first.'; return; }
  searchStatus.textContent = 'Searching...';
  const fullQuery = `${query}, Cape Coral, FL`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(fullQuery)}`;
  try{
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const results = await res.json();
    if(!results.length){ searchStatus.textContent = 'No match found. Try adding city/state or a ZIP code.'; return; }
    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    if(searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<strong>${query}</strong><br>Verify property and waterway details before purchase.`).openPopup();
    map.setView([lat, lon], 16);
    searchStatus.textContent = 'Address found. Click nearby canals for details.';
  }catch(e){
    searchStatus.textContent = 'Search is temporarily unavailable. Try again shortly.';
  }
}

document.getElementById('searchBtn').addEventListener('click', searchAddress);
document.getElementById('addressSearch').addEventListener('keydown', e => { if(e.key === 'Enter') searchAddress(); });
showSalt.addEventListener('change', renderLayer);
showFresh.addEventListener('change', renderLayer);
showLabels.addEventListener('change', addLabels);
document.getElementById('resetBtn').addEventListener('click', () => {
  showSalt.checked = true; showFresh.checked = true; showLabels.checked = false;
  if(searchMarker){ map.removeLayer(searchMarker); searchMarker = null; }
  renderLayer();
});

loadCanals();
