const CAPE_CORAL_CENTER = [26.629, -81.997];
const map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView(CAPE_CORAL_CENTER, 11);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let canalLayer;
let labelLayer = L.layerGroup();
let allFeatures = [];
let selectedLayer = null;
const saltToggle = document.getElementById('saltToggle');
const freshToggle = document.getElementById('freshToggle');
const labelsToggle = document.getElementById('labelsToggle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');
const countLabel = document.getElementById('countLabel');
const detailsPanel = document.getElementById('detailsPanel');

function waterType(feature){ return String(feature?.properties?.WATER_TYPE || '').toUpperCase(); }
function isSalt(feature){ return waterType(feature).includes('SALT'); }
function isFresh(feature){ return waterType(feature).includes('FRESH'); }
function canalColor(feature){ return isSalt(feature) ? '#0b9eac' : '#2f80ed'; }
function styleFeature(feature){
  return { color: canalColor(feature), weight: 3, opacity: .92, fillColor: canalColor(feature), fillOpacity: .22 };
}
function selectedStyle(){ return { color:'#f6b43f', weight:5, opacity:1, fillColor:'#f6b43f', fillOpacity:.32 }; }
function featureVisible(feature){
  if(isSalt(feature) && !saltToggle.checked) return false;
  if(isFresh(feature) && !freshToggle.checked) return false;
  return true;
}
function popupHtml(props){
  const name = props.NAME || 'Unnamed waterway';
  const type = props.WATER_TYPE || 'Verify';
  const nav = props.NAV_SYST || 'Verify';
  const basin = props.Basin || 'Verify';
  return `<div class="popup-title">${escapeHtml(name)}</div>
    <div class="popup-row"><b>Water type:</b> ${escapeHtml(type)}</div>
    <div class="popup-row"><b>Navigation system:</b> ${escapeHtml(nav)}</div>
    <div class="popup-row"><b>Basin:</b> ${escapeHtml(basin)}</div>
    <hr>
    <div class="popup-row">Always verify bridge clearance, route, depth, seawall, dock, and lift details before purchasing.</div>`;
}
function escapeHtml(value){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function updateDetails(props){
  detailsPanel.innerHTML = `<div class="eyebrow">Selected Waterway</div>
    <h2>${escapeHtml(props.NAME || 'Unnamed waterway')}</h2>
    <dl>
      <div><dt>Water Type</dt><dd>${escapeHtml(props.WATER_TYPE || 'Verify')}</dd></div>
      <div><dt>Navigation System</dt><dd>${escapeHtml(props.NAV_SYST || 'Verify')}</dd></div>
      <div><dt>Basin</dt><dd>${escapeHtml(props.Basin || 'Verify')}</dd></div>
    </dl>`;
}
function onEachFeature(feature, layer){
  layer.bindPopup(popupHtml(feature.properties || {}));
  layer.on('click', () => {
    if(selectedLayer && selectedLayer.setStyle) canalLayer.resetStyle(selectedLayer);
    selectedLayer = layer;
    layer.setStyle(selectedStyle());
    layer.bringToFront();
    updateDetails(feature.properties || {});
  });
}
function renderCanals(){
  if(canalLayer) map.removeLayer(canalLayer);
  labelLayer.clearLayers();
  const visible = allFeatures.filter(featureVisible);
  canalLayer = L.geoJSON({ type:'FeatureCollection', features: visible }, { style: styleFeature, onEachFeature }).addTo(map);
  if(labelsToggle.checked){ addLabels(visible); }
  countLabel.textContent = `${visible.length.toLocaleString()} waterways shown`;
}
function addLabels(features){
  features.forEach(f => {
    const name = f.properties?.NAME;
    if(!name) return;
    const center = L.geoJSON(f).getBounds().getCenter();
    L.marker(center, { icon: L.divIcon({ className:'canal-label', html: escapeHtml(name), iconSize:null }) }).addTo(labelLayer);
  });
  labelLayer.addTo(map);
}
function resetView(){
  if(selectedLayer && canalLayer) canalLayer.resetStyle(selectedLayer);
  selectedLayer = null;
  map.setView(CAPE_CORAL_CENTER, 11);
  searchInput.value = '';
}
function searchCanal(){
  const q = searchInput.value.trim().toLowerCase();
  if(!q) return;
  const match = allFeatures.find(f => String(f.properties?.NAME || '').toLowerCase().includes(q));
  if(!match){ alert('No matching canal found. Try another canal name.'); return; }
  const bounds = L.geoJSON(match).getBounds();
  map.fitBounds(bounds.pad(.4));
  setTimeout(() => {
    canalLayer.eachLayer(layer => {
      if(layer.feature?.properties?.OBJECTID === match.properties?.OBJECTID){
        layer.fire('click');
        layer.openPopup();
      }
    });
  }, 250);
}

fetch('Canals.geojson')
  .then(r => { if(!r.ok) throw new Error('GeoJSON failed to load'); return r.json(); })
  .then(data => {
    allFeatures = data.features || [];
    renderCanals();
    const bounds = L.geoJSON(data).getBounds();
    if(bounds.isValid()) map.fitBounds(bounds.pad(.05));
    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 750);
  })
  .catch(err => {
    console.error(err);
    countLabel.textContent = 'Map data could not load';
    alert('The canal map data did not load. Make sure Canals.geojson is in the same GitHub folder as index.html.');
  });

[saltToggle, freshToggle].forEach(el => el.addEventListener('change', renderCanals));
labelsToggle.addEventListener('change', renderCanals);
searchBtn.addEventListener('click', searchCanal);
searchInput.addEventListener('keydown', e => { if(e.key === 'Enter') searchCanal(); });
resetBtn.addEventListener('click', resetView);
window.addEventListener('resize', () => setTimeout(() => map.invalidateSize(), 100));
