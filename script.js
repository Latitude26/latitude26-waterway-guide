const DATA_URL = 'Canals.geojson';
const CONTACT_URL = 'https://livelatitude26.com/content/cape-coral-waterfront-explorertm';
const CAPE_CORAL = [26.642, -81.997];

let map;
let canalLayer;
let labelLayer;
let selectedLayer = null;
let allFeatures = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(ch) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch];
  });
}

function getEl(id) {
  return document.getElementById(id);
}

function waterType(props) {
  const t = String(props.WATER_TYPE || '').toUpperCase();
  return t.includes('FRESH') ? 'FRESH' : 'SALT';
}

function waterLabel(props) {
  return waterType(props) === 'FRESH'
    ? 'Freshwater'
    : 'Saltwater / Gulf Access System';
}

function getStyle(feature) {
  const props = feature.properties || {};
  const type = waterType(props);

  const showSalt = getEl('showSalt') ? getEl('showSalt').checked : true;
  const showFresh = getEl('showFresh') ? getEl('showFresh').checked : true;

  const visible =
    (type === 'SALT' && showSalt) ||
    (type === 'FRESH' && showFresh);

  return {
    color: type === 'FRESH' ? '#2f80ed' : '#06a6a6',
    weight: visible ? 2.5 : 0,
    opacity: visible ? 0.9 : 0,
    fillOpacity: visible ? 0.13 : 0,
    interactive: visible
  };
}

function selectedStyle() {
  return {
    color: '#f2ae2e',
    weight: 5,
    opacity: 1,
    fillOpacity: 0.23
  };
}

function popupHtml(props) {
  const name = props.NAME || 'Unnamed Waterway';
  const nav = props.NAV_SYST || 'Not listed';
  const basin = props.Basin || 'Not listed';

  return (
    '<div class="popup-title">' + escapeHtml(name) + '</div>' +
    '<span class="popup-badge">' + escapeHtml(waterLabel(props)) + '</span>' +
    '<div class="popup-grid">' +
      '<div class="popup-row"><span>Navigation System</span><strong>' + escapeHtml(nav) + '</strong></div>' +
      '<div class="popup-row"><span>Basin</span><strong>' + escapeHtml(basin) + '</strong></div>' +
    '</div>' +
    '<a class="popup-cta" href="' + CONTACT_URL + '" target="_blank" rel="noopener">Ask Latitude 26° about this waterway</a>'
  );
}

function selectFeature(layer, feature) {
  if (selectedLayer && selectedLayer !== layer) {
    canalLayer.resetStyle(selectedLayer);
  }

  selectedLayer = layer;
  layer.setStyle(selectedStyle());
  layer.bringToFront();

  const p = feature.properties || {};

  getEl('selectedName').textContent = p.NAME || 'Unnamed Waterway';
  getEl('selectedType').textContent = waterLabel(p);
  getEl('selectedNav').textContent = p.NAV_SYST || 'Not listed';
  getEl('selectedBasin').textContent = p.Basin || 'Not listed';
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};

  allFeatures.push({
    name: props.NAME || 'Unnamed Waterway',
    feature: feature,
    layer: layer
  });

  layer.bindPopup(popupHtml(props));

  layer.on('click', function() {
    selectFeature(layer, feature);
  });

  layer.on('mouseover', function() {
    if (layer !== selectedLayer) {
      layer.setStyle({
        weight: 4,
        fillOpacity: 0.22
      });
    }
  });

  layer.on('mouseout', function() {
    if (layer !== selectedLayer) {
      canalLayer.resetStyle(layer);
    }
  });
}

function buildLabels() {
  if (labelLayer) {
    labelLayer.remove();
  }

  labelLayer = L.layerGroup();

  const showLabels = getEl('showLabels') ? getEl('showLabels').checked : false;

  if (!showLabels) {
    return;
  }

  allFeatures.forEach(function(item) {
    const p = item.feature.properties || {};

    if (!p.NAME) {
      return;
    }

    const type = waterType(p);
    const showSalt = getEl('showSalt').checked;
    const showFresh = getEl('showFresh').checked;

    if ((type === 'SALT' && !showSalt) || (type === 'FRESH' && !showFresh)) {
      return;
    }

    try {
      const center = item.layer.getBounds().getCenter();

      L.marker(center, {
        icon: L.divIcon({
          className: 'canal-label',
          html: escapeHtml(p.NAME),
          iconSize: null
        }),
        interactive: false
      }).addTo(labelLayer);
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
  const box = getEl('searchResults');
  box.innerHTML = '';
  box.hidden = false;

  if (!matches.length) {
    box.innerHTML = '<div class="result-btn">No canal matches. Try a full Cape Coral address.</div>';
    return;
  }

  matches.slice(0, 10).forEach(function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'result-btn';
    btn.textContent = item.name;

    btn.addEventListener('click', function() {
      box.hidden = true;
      selectFeature(item.layer, item.feature);
      item.layer.openPopup();

      map.fitBounds(item.layer.getBounds(), {
        padding: [60, 60],
        maxZoom: 15
      });
    });

    box.appendChild(btn);
  });
}

function doSearch() {
  const input = getEl('searchInput');
  const q = input.value.trim().toUpperCase();

  if (!q) {
    return;
  }

  const matches = allFeatures.filter(function(item) {
    return item.name.toUpperCase().includes(q);
  });

  showSearchResults(matches);
}

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    preferCanvas: true
  }).setView(CAPE_CORAL, 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '© OpenStreetMap contributors © CARTO'
  }).addTo(map);

  setTimeout(function() {
    map.invalidateSize();
  }, 300);

  setTimeout(function() {
    map.invalidateSize();
  }, 1200);

  window.addEventListener('resize', function() {
    map.invalidateSize();
  });
}

function loadData() {
  const loading = document.querySelector('.loading');

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function(res) {
      if (!res.ok) {
        throw new Error('Could not load Canals.geojson');
      }

      return res.json();
    })
    .then(function(data) {
      allFeatures = [];

      canalLayer = L.geoJSON(data, {
        style: getStyle,
        onEachFeature: onEachFeature
      }).addTo(map);

      map.fitBounds(canalLayer.getBounds(), {
        padding: [30, 30]
      });

      const total = data.features.length;
      const fresh = data.features.filter(function(f) {
        return waterType(f.properties || {}) === 'FRESH';
      }).length;
      const salt = total - fresh;

      if (getEl('mapStats')) {
        getEl('mapStats').textContent =
          total.toLocaleString() + ' waterways shown • ' +
          salt + ' saltwater / Gulf access • ' +
          fresh + ' freshwater';
      }

      buildLabels();
    })
    .catch(function(err) {
      console.error(err);

      if (getEl('mapStats')) {
        getEl('mapStats').textContent = 'Waterway data could not be loaded.';
      }
    })
    .finally(function() {
      if (loading) {
        loading.remove();
      }

      setTimeout(function() {
        map.invalidateSize();
      }, 400);
    });
}

function bindEvents() {
  if (getEl('searchBtn')) {
    getEl('searchBtn').addEventListener('click', doSearch);
  }

  if (getEl('searchInput')) {
    getEl('searchInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        doSearch();
      }
    });

    getEl('searchInput').addEventListener('input', function() {
      const q = getEl('searchInput').value.trim().toUpperCase();

      if (q.length < 2) {
        getEl('searchResults').hidden = true;
        return;
      }

      const matches = allFeatures.filter(function(item) {
        return item.name.toUpperCase().includes(q);
      });

      if (matches.length) {
        showSearchResults(matches);
      }
    });
  }

  ['showSalt', 'showFresh', 'showLabels'].forEach(function(id) {
    if (getEl(id)) {
      getEl(id).addEventListener('change', refreshFilters);
    }
  });

  if (getEl('resetBtn')) {
    getEl('resetBtn').addEventListener('click', function() {
      getEl('showSalt').checked = true;
      getEl('showFresh').checked = true;
      getEl('showLabels').checked = false;
      getEl('searchInput').value = '';
      getEl('searchResults').hidden = true;

      refreshFilters();

      if (canalLayer) {
        map.fitBounds(canalLayer.getBounds(), {
          padding: [30, 30]
        });
      }
    });
  }

  if (getEl('reviewBtn')) {
    getEl('reviewBtn').addEventListener('click', function() {
      window.open(CONTACT_URL, '_blank');
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initMap();
  bindEvents();
  loadData();
});
