// Initialize map centered on the Eastern/Central US
const map = L.map("map", {
  zoomControl: false
}).setView([38.5, -86.5], 4);

// Place zoom controls in top-right so they don't overlap the HUD card
L.control.zoom({ position: "topright" }).addTo(map);

// Free Esri World Street Map tiles (No API key, no tile-blocking policies)
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
  maxZoom: 19
}).addTo(map);

const markers = [];
const selectEl = document.getElementById("stop-select");
document.getElementById("stat-stops").textContent = ROADTRIP_STOPS.length;

// Add pins and populate dropdown
ROADTRIP_STOPS.forEach((stop, index) => {
  const hasStory = stop.story && stop.story.trim().length > 0;

  // Offset the second New Haven visit slightly so both pins remain clickable
  const isDuplicateNewHaven = stop.stopNumber === 9;
  const lat = isDuplicateNewHaven ? stop.lat - 0.04 : stop.lat;
  const lng = isDuplicateNewHaven ? stop.lng - 0.04 : stop.lng;

  const pinIcon = L.divIcon({
    className: "",
    html: `<div class="custom-pin ${hasStory ? "pin-story" : "pin-empty"}">${stop.stopNumber}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });

  const popupHtml = `
    <div class="popup-card">
      <span class="popup-badge ${hasStory ? "badge-story" : "badge-empty"}">
        Stop #${stop.stopNumber} ${hasStory ? "&bull; Story" : ""}
      </span>
      <h3>${stop.name}</h3>
      <div class="popup-dates">${stop.dates}</div>
      ${
        hasStory
          ? `<div class="popup-story">${stop.story}</div>`
          : `<div class="popup-empty-note">No notes recorded for this stop yet.</div>`
      }
    </div>
  `;

  const marker = L.marker([lat, lng], { icon: pinIcon })
    .addTo(map)
    .bindPopup(popupHtml);

  markers.push(marker);

  // Add option to "Jump to a city..." dropdown
  const opt = document.createElement("option");
  opt.value = index;
  opt.textContent = `${stop.stopNumber}. ${stop.name}${hasStory ? " ★" : ""}`;
  selectEl.appendChild(opt);
});

// Dropdown navigation handler
selectEl.addEventListener("change", (e) => {
  const idx = e.target.value;
  if (idx === "") return;
  const targetMarker = markers[idx];
  map.flyTo(targetMarker.getLatLng(), 7, { duration: 1.2 });
  targetMarker.openPopup();
});

// Fetch realistic driving route via OSRM public routing engine
async function drawDrivingRoute() {
  const waypoints = ROADTRIP_STOPS.map((s) => `${s.lng},${s.lat}`).join(";");
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(osrmUrl);
    if (!response.ok) throw new Error("Routing service unavailable");
    const data = await response.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      // Draw outer casing + inner route line for clean map visibility
      L.polyline(latLngs, {
        color: "#ffffff",
        weight: 6,
        opacity: 0.85
      }).addTo(map);

      const routeLine = L.polyline(latLngs, {
        color: "#2b6cb0",
        weight: 3.5,
        opacity: 0.9
      }).addTo(map);

      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

      // Update mileage & driving time stats
      const miles = Math.round(route.distance * 0.000621371).toLocaleString();
      const hours = Math.round(route.duration / 3600);
      document.getElementById("stat-miles").textContent = `~${miles} mi (${hours}h)`;
      return;
    }
  } catch (err) {
    console.warn("Falling back to direct point-to-point route:", err);
  }

  // Fallback straight-line polyline if OSRM is unreachable
  const fallbackCoords = ROADTRIP_STOPS.map((s) => [s.lat, s.lng]);
  const fallbackLine = L.polyline(fallbackCoords, {
    color: "#2b6cb0",
    weight: 3,
    dashArray: "6, 8"
  }).addTo(map);

  map.fitBounds(fallbackLine.getBounds(), { padding: [50, 50] });
  document.getElementById("stat-miles").textContent = "21 Stops";
}

drawDrivingRoute();