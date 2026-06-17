const DATA_URL = 'Canals.geojson';
const CAPE_CORAL = [26.642, -81.997];

document.addEventListener('DOMContentLoaded', function () {
  const map = L.map('map').setView(CAPE_CORAL, 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  fetch(DATA_URL)
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      const canalLayer = L.geoJSON(data, {
        style: function(feature) {
          const props = feature.properties || {};
          const type = String(props.WATER_TYPE || '').toLowerCase();

          return {
            color: type.includes('fresh') ? '#2f80ed' : '#06a6a6',
            weight: 2.5,
            opacity: 0.9
          };
        },
        onEachFeature: function(feature, layer) {
          const props = feature.properties || {};
          const name = props.NAME || 'Unnamed Waterway';
          const waterType = props.WATER_TYPE || 'Waterway';
          const navSystem = props.NAV_SYST || 'Not listed';
          const basin = props.Basin || 'Not listed';

          layer.bindPopup(
            '<div class="popup-title">' + name + '</div>' +
            '<span class="popup-badge">' + waterType + '</span>' +
            '<div class="popup-grid">' +
              '<div class="popup-row"><span>Navigation System</span><strong>' + navSystem + '</strong></div>' +
              '<div class="popup-row"><span>Basin</span><strong>' + basin + '</strong></div>' +
            '</div>'
          );
        }
      }).addTo(map);

      map.fitBounds(canalLayer.getBounds());

      const loading = document.querySelector('.loading');
      if (loading) loading.remove();

      setTimeout(function() {
        map.invalidateSize();
      }, 300);
    })
    .catch(function(error) {
      console.error('Map data failed to load:', error);
    });

  setTimeout(function() {
    map.invalidateSize();
  }, 500);
});
