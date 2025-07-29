mapboxgl.accessToken = 'pk.eyJ1Ijoic2ZkdW5jYW4iLCJhIjoiY2x2Z3QybHh2MHlwcTJpczJyejAyYWVpNyJ9.DLToR14vGnafkx-pCGj6KA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/sfduncan/cmdn93s5d009r01s56mby9s8z',
  center: [-74.006, 40.7128],
  zoom: 13
});

let osmFeatures = [];
let commonFeatures = [];

map.on("load", async () => {
  try {
    const [osmData, commonData] = await Promise.all([
      fetch("https://storage.googleapis.com/nycpoiosm/NYC_OSM_POI.geojson").then(r => r.json()),
      fetch("NYC_POI.geojson").then(r => r.json())  // Local file
    ]);

    osmFeatures = osmData.features;
    commonFeatures = commonData.features;

    map.addSource("osm-pois", { type: "geojson", data: osmData });
    map.addSource("common-pois", { type: "geojson", data: commonData });

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

    document.getElementById("toggle-osm").addEventListener("change", (e) => {
      map.setLayoutProperty("osm-poi-layer", "visibility", e.target.checked ? "visible" : "none");
      updateCounts();
    });

    document.getElementById("toggle-common").addEventListener("change", (e) => {
      map.setLayoutProperty("common-poi-layer", "visibility", e.target.checked ? "visible" : "none");
      updateCounts();
    });

    updateCounts();
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

map.on("moveend", updateCounts);


// Dropdown toggle logic
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const targetId = toggle.getAttribute('data-target');
    const content = document.getElementById(targetId);
    const isOpen = content.style.display === 'block';

    content.style.display = isOpen ? 'none' : 'block';
    toggle.classList.toggle('open', !isOpen);
  });
});
