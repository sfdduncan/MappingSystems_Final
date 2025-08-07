mapboxgl.accessToken = 'pk.eyJ1Ijoic2ZkdW5jYW4iLCJhIjoiY2x2Z3QybHh2MHlwcTJpczJyejAyYWVpNyJ9.DLToR14vGnafkx-pCGj6KA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/sfduncan/cmdn93s5d009r01s56mby9s8z',
  center: [-74.006, 40.7128],
  zoom: 13
});

let osmFeatures = [];
let commonFeatures = [];

let revealMode = false;
const lensHalfSizePx = 60;

map.on("load", async () => {
  try {
    const [osmData, commonData] = await Promise.all([
      fetch("https://storage.googleapis.com/nycpoiosm/NYC_OSM_POI.geojson").then(r => r.json()),
      fetch("https://storage.googleapis.com/nycpoiosm/NYC_POI.geojson").then(r => r.json())
    ]);

    osmFeatures = osmData.features;
    commonFeatures = commonData.features;

    map.addSource("osm-pois", { type: "geojson", data: osmData });
    map.addSource("common-pois", { type: "geojson", data: commonData });

    // Base layers
    map.addLayer({
      id: "osm-poi-layer",
      type: "circle",
      source: "osm-pois",
      paint: {
        "circle-radius": 3,
        "circle-opacity": 0.7,
        "circle-color": "#000",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1
      }
    });

    map.addLayer({
      id: "common-poi-layer",
      type: "circle",
      source: "common-pois",
      paint: {
        "circle-radius": 3,
        "circle-opacity": 0.7,
        "circle-color": "#fff",
        "circle-stroke-color": "#000",
        "circle-stroke-width": 1
      }
    });

    // Lens layers (initially hidden)
    map.addLayer({
      id: "osm-poi-lens",
      type: "circle",
      source: "osm-pois",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 4,
        "circle-color": "#e74c3c",
        "circle-opacity": 0.9,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1
      }
    });

    map.addSource("lens-rect", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });

    map.addLayer({
      id: "lens-outline",
      type: "line",
      source: "lens-rect",
      layout: { visibility: "none" },
      paint: {
        "line-width": 2,
        "line-color": "#000",
        "line-dasharray": [2, 2]
      }
    });

    // Checkbox toggle logic
    document.getElementById("toggle-osm").addEventListener("change", (e) => {
      map.setLayoutProperty("osm-poi-layer", "visibility", e.target.checked ? "visible" : "none");
      updateCounts();
    });

    document.getElementById("toggle-common").addEventListener("change", (e) => {
      map.setLayoutProperty("common-poi-layer", "visibility", e.target.checked ? "visible" : "none");
      updateCounts();
    });

    // 🔍 Reveal mode toggle
    const revealButton = document.getElementById("toggle-reveal");
    const osmCheckbox = document.getElementById("toggle-osm");

    revealButton.addEventListener("click", () => {
      revealMode = !revealMode;

      map.setLayoutProperty("osm-poi-lens", "visibility", revealMode ? "visible" : "none");
      map.setLayoutProperty("lens-outline", "visibility", revealMode ? "visible" : "none");
      revealButton.classList.toggle("active", revealMode);

      if (revealMode) {
        map.setLayoutProperty("osm-poi-layer", "visibility", "none");
        osmCheckbox.checked = false;

        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const centerPoint = new mapboxgl.Point(rect.width / 2, rect.height / 2);
        updateLens(centerPoint);
      } else {
        map.setFilter("osm-poi-lens", ["==", ["get", "id"], "___none___"]);
        map.getSource("lens-rect").setData({ type: "FeatureCollection", features: [] });
        document.getElementById("osm-count").textContent = 0;
      }

      updateCounts();
    });

    updateCounts();
    map.on("moveend", updateCounts);

  } catch (err) {
    console.error("Error loading data or adding layers:", err);
  }
});

function updateCounts() {
  const bounds = map.getBounds();

  let osmCount = 0;
  let commonCount = 0;

  const showOSM = map.getLayer("osm-poi-layer") &&
                  map.getLayoutProperty("osm-poi-layer", "visibility") !== "none";
  const showCommon = map.getLayer("common-poi-layer") &&
                     map.getLayoutProperty("common-poi-layer", "visibility") !== "none";

  if (showOSM) {
    osmCount = osmFeatures.filter(f => bounds.contains(f.geometry.coordinates)).length;
  }

  if (showCommon) {
    commonCount = commonFeatures.filter(f => bounds.contains(f.geometry.coordinates)).length;
  }

  document.getElementById("osm-count").textContent = osmCount;
  document.getElementById("common-count").textContent = commonCount;
}

// Lens follows cursor
map.on("mousemove", (e) => {
  if (!revealMode) return;
  updateLens(e.point);
});

function updateLens(point) {
  const p1 = new mapboxgl.Point(point.x - lensHalfSizePx, point.y - lensHalfSizePx);
  const p2 = new mapboxgl.Point(point.x + lensHalfSizePx, point.y - lensHalfSizePx);
  const p3 = new mapboxgl.Point(point.x + lensHalfSizePx, point.y + lensHalfSizePx);
  const p4 = new mapboxgl.Point(point.x - lensHalfSizePx, point.y + lensHalfSizePx);

  const c1 = map.unproject(p1), c2 = map.unproject(p2), c3 = map.unproject(p3), c4 = map.unproject(p4);

  const squarePoly = {
    type: "Polygon",
    coordinates: [[
      [c1.lng, c1.lat],
      [c2.lng, c2.lat],
      [c3.lng, c3.lat],
      [c4.lng, c4.lat],
      [c1.lng, c1.lat]
    ]]
  };

  map.setFilter("osm-poi-lens", ["within", squarePoly]);
  map.getSource("lens-rect").setData({
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: squarePoly }]
  });

  // Count features in lens using Turf
  const lensCount = osmFeatures.filter(f => turf.booleanPointInPolygon(f, squarePoly)).length;
  document.getElementById("osm-count").textContent = lensCount;
}

// ⬇ Dropdown toggles (unchanged)
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const targetId = toggle.getAttribute('data-target');
    const content = document.getElementById(targetId);
    const isOpen = content.style.display === 'block';

    content.style.display = isOpen ? 'none' : 'block';
    toggle.classList.toggle('open', !isOpen);
  });
});
