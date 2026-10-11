import {
  placeType,
  havenStatus,
  trustPoints,
  havenCriteriaLabel
} from "./havens.js?v=grid-4";


import {
  distinctRoutes,
  detourPoints
} from "./route-options.js?v=routes-1";


import {
  loadRouteEvidence
} from "./arcgis.js?v=grid-4";


import {
  distance,
  distanceToRoute,
  scoreRoute,
  penalties
} from "./scoring.js?v=grid-4";


import {
  connectivityCells,
  connectivityAtPoint,
  connectionColor,
  connectionLabel,
  routeConnectivity
} from "./connectivity.js?v=grid-4";


const $ =
  id =>
    document.getElementById(
      id
    );


const reportLifetime =
  30 *
  86400000;


let key =
  "";

let origin =
  null;

let target =
  null;

let reportPoint =
  null;

let rawRoutes =
  [];

let havens =
  [];

let havenKnown =
  false;

let selected =
  null;

let revision =
  0;

let lastSearch =
  0;

let scoredRoutes =
  [];

let unsafeMode =
  false;

let safetyWatchId =
  null;

let safetyLastPosition =
  null;

let inactivityTimer =
  null;

let safetyCountdownTimer =
  null;

let alarmTimer =
  null;

let alarmContext =
  null;

let demoAlarmTimer =
  null;

let demoSafetyCheckActive =
  false;

// ===============================
// SAFETY MODE SETTINGS
// ===============================
// Hackathon demo: wait 10 seconds, then sound the alarm and immediately
// ATTEMPT to open the phone's 911 calling flow. There is no SafeRoute
// confirmation dialog in this automatic timeout path. The phone/browser
// itself may still show its own system confirmation, which JavaScript
// cannot bypass.
const DEMO_ALARM_DELAY =
  10 * 1000;

// Real I Feel Unsafe mode: no meaningful movement for 5 minutes triggers
// the same alarm + immediate emergency-call attempt.
const UNSAFE_INACTIVITY_TIME =
  5 * 60 * 1000;

// GPS often drifts a few meters even while a person is standing still.
// Only movement of at least 20 meters resets the inactivity timer.
const MOVEMENT_THRESHOLD_METERS =
  20;

// Keep the emergency URI in one place so it is easy to change while testing.
// WARNING: on a real phone, tel:911 can open the emergency dialer.
const EMERGENCY_CALL_URI =
  "tel:911";


let reports =
  [];


try {
  reports =
    JSON.parse(
      localStorage.getItem(
        "saferoute-reports"
      ) ||
      "[]"
    )
      .filter(
        report =>
          report &&

          Object.prototype
            .hasOwnProperty.call(
              penalties,
              report.type
            ) &&

          Array.isArray(
            report.position
          ) &&

          report.position.length ===
            2 &&

          report.position.every(
            Number.isFinite
          ) &&

          Number.isFinite(
            report.created
          ) &&

          report.created >
            Date.now() -
              reportLifetime
      )
      .slice(-100);
}

catch {
  reports =
    [];
}


// =====================================================
// BASIC HELPERS
// =====================================================

function status(
  message
) {
  $("status")
    .textContent =
      message;
}


function element(
  tag,
  text = "",
  className = ""
) {
  const node =
    document.createElement(
      tag
    );


  node.textContent =
    text;


  if (
    className
  ) {
    node.className =
      className;
  }


  return node;
}


function pretty(
  value
) {
  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );
}


async function request(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        signal:
          AbortSignal.timeout(
            25000
          )
      }
    );


  if (
    !response.ok
  ) {
    let details =
      {};


    try {
      details =
        await response.json();
    }

    catch {}


    if (
      details.code ===
      "NoSegment"
    ) {
      throw new Error(
        "No mapped walking path is close enough to the selected location."
      );
    }


    if (
      details.code ===
      "NoRoute"
    ) {
      throw new Error(
        "No connected walking route was found."
      );
    }


    throw new Error(
      `Service returned ${response.status}.`
    );
  }


  return response.json();
}


// =====================================================
// MAP
// =====================================================

if (
  !window.L
) {
  throw new Error(
    "Leaflet did not load."
  );
}


const map =
  L.map(
    "map",
    {
      zoomControl:
        false
    }
  )
    .setView(
      [
        33.7490,
        -84.3880
      ],
      13
    );


L.control
  .zoom({
    position:
      "topright"
  })
  .addTo(
    map
  );


L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom:
      19,

    attribution:
      "&copy; OpenStreetMap contributors"
  }
)
  .addTo(
    map
  );


const routeLayer =
  L.layerGroup()
    .addTo(
      map
    );


const havenLayer =
  L.layerGroup()
    .addTo(
      map
    );


const reportLayer =
  L.layerGroup()
    .addTo(
      map
    );


const connectivityLayer =
  L.layerGroup()
    .addTo(
      map
    );


// Canvas makes thousands of colored cells much faster.
const connectivityRenderer =
  L.canvas({
    padding:
      0.5
  });


const originMarker =
  L.circleMarker(
    [0, 0],
    {
      radius:
        8,

      color:
        "white",

      weight:
        3,

      fillColor:
        "#246baf",

      fillOpacity:
        1
    }
  )
    .bindPopup(
      "Your current location"
    );


let targetMarker =
  null;


// =====================================================
// CONNECTIVITY HEATMAP
// =====================================================

function renderConnectivityZones() {
  connectivityLayer
    .clearLayers();


  for (
    const cell of
      connectivityCells
  ) {
    const color =
      connectionColor(
        cell.score
      );


    L.rectangle(
      cell.bounds,
      {
        renderer:
          connectivityRenderer,

        stroke:
          false,

        fillColor:
          color,

        fillOpacity:
          0.20,

        // IMPORTANT:
        // users can still click the map through the heatmap.
        interactive:
          false
      }
    )
      .addTo(
        connectivityLayer
      );
  }
}


// =====================================================
// APP STATE
// =====================================================

function invalidate() {
  revision++;

  rawRoutes =
    [];

  scoredRoutes =
    [];

  selected =
    null;

  routeLayer
    .clearLayers();

  $("routes")
    .replaceChildren();

  $("route-count")
    .textContent =
      "0 ROUTES";

  renderSelectedRouteDetails();
}


function setTarget(
  point,
  name
) {
  invalidate();


  target =
    point;


  $("destination")
    .value =
      name;


  if (
    targetMarker
  ) {
    targetMarker
      .remove();
  }


  targetMarker =
    L.marker(
      point
    )
      .addTo(
        map
      )
      .bindPopup(
        name
      );


  const cell =
    connectivityAtPoint(
      point
    );


  if (
    cell
  ) {
    status(
      `Destination selected · Demo connectivity: ${connectionLabel(cell.score)} (${cell.score > 0 ? "+" : ""}${cell.score}). Compare routes to continue.`
    );
  }

  else {
    status(
      "Destination selected. Compare routes to plan this walk."
    );
  }
}


function setLive() {
  $("mode-badge")
    .textContent =
      "LIVE ROUTES · DEMO CONNECTIVITY";
}


// Click map to select destination.
map.on(
  "click",
  event => {
    reportPoint = [
      event.latlng.lat,
      event.latlng.lng
    ];


    setTarget(
      reportPoint,
      "Selected map location"
    );
  }
);


// =====================================================
// ROUTE CARDS + ROUTE LINES
// =====================================================

function signedScore(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  const rounded =
    Math.round(value * 10) / 10;

  return `${rounded > 0 ? "+" : ""}${rounded}`;
}


function routeDisplayName(route) {
  const index =
    scoredRoutes.findIndex(
      item => item.id === route.id
    );

  return `Route ${index >= 0 ? index + 1 : 1}`;
}


function routeRecommendation(route) {
  if (!scoredRoutes.length) {
    return route.category;
  }

  const fastest =
    Math.min(
      ...scoredRoutes.map(
        item => item.duration
      )
    );

  if (route.id === scoredRoutes[0]?.id) {
    return "Safest route";
  }

  if (route.duration === fastest) {
    return "Fastest option";
  }

  return route.category;
}


function routeLineColor(route, active) {
  if (active) {
    return "#1a73e8";
  }

  if (route.score >= 75) {
    return "#2a9d5b";
  }

  if (route.score >= 55) {
    return "#d79a2b";
  }

  return "#c84a42";
}


function routeSafePlaces(route) {
  return havens
    .map(
      place => ({
        place,
        routeDistance:
          distanceToRoute(
            place.position,
            route.points
          )
      })
    )
    .filter(
      item =>
        item.routeDistance <= 300
    )
    .sort(
      (a, b) => {
        const aOpen =
          havenStatus(a.place).state === "open"
            ? 0
            : 1;

        const bOpen =
          havenStatus(b.place).state === "open"
            ? 0
            : 1;

        return (
          aOpen - bOpen ||
          a.routeDistance - b.routeDistance
        );
      }
    );
}


function generateScoreExplanation(route) {
  const reasons = [];
  const cautions = [];
  const breakdown = route.breakdown;

  if (breakdown.safePlaces >= 10) {
    reasons.push("several nearby public or trusted places");
  }
  else if (breakdown.safePlaces > 0) {
    reasons.push("some nearby Safe Havens");
  }

  if (breakdown.lighting >= 10) {
    reasons.push("strong mapped streetlight coverage");
  }
  else if (breakdown.lighting < 0) {
    cautions.push("weaker lighting coverage");
  }

  if (breakdown.crime === 0) {
    reasons.push("no scored recent crime penalty");
  }
  else if (breakdown.crime < 0) {
    cautions.push("recent crime reports near the route");
  }

  if (breakdown.connectivity >= 5) {
    reasons.push("stronger demo connectivity");
  }
  else if (breakdown.connectivity < 0) {
    cautions.push("weaker demo connectivity");
  }

  if (breakdown.community > 0) {
    reasons.push("positive community reports");
  }
  else if (breakdown.community < 0) {
    cautions.push("community safety concerns");
  }

  const good =
    reasons.length
      ? reasons.slice(0, 3).join(", ")
      : "the available route evidence";

  const caution =
    cautions.length
      ? ` The main caution is ${cautions.slice(0, 2).join(" and ")}.`
      : "";

  return `This route scores ${route.score}/100 based on ${good}.${caution}`;
}


function renderSelectedRouteDetails() {
  const container =
    $("route-details");

  const route =
    scoredRoutes.find(
      item => item.id === selected
    );

  if (!route) {
    $("sheet-title").textContent =
      "Choose a destination";

    container.innerHTML = `
      <div class="empty-route-details">
        <div class="empty-icon">↗</div>
        <h2>Plan a route to compare safety</h2>
        <p>Search for a destination above, then choose among the available walking routes.</p>
      </div>`;

    return;
  }

  const name =
    routeDisplayName(route);

  $("sheet-title").textContent =
    `${name} · ${Math.round(route.duration / 60)} min`;

  container.replaceChildren();

  const hero =
    element("div", "", "detail-hero");

  const heroText =
    element("div");

  heroText.append(
    element("span", routeRecommendation(route).toUpperCase(), "sheet-kicker"),
    element("h2", name),
    element(
      "div",
      `${Math.round(route.duration / 60)} min · ${(route.distance / 1609.344).toFixed(1)} mi · ${(route.distance / 1000).toFixed(1)} km`,
      "detail-meta"
    )
  );

  hero.append(
    heroText,
    element("div", String(route.score), "detail-score")
  );

  container.append(hero);

  const scoreSection =
    element("section", "", "detail-section");

  scoreSection.append(
    element("h3", "Why this score?")
  );

  const scoreGrid =
    element("div", "", "score-grid");

  const scoreItems = [
    ["Starting score", route.breakdown.base],
    ["Safe places", route.breakdown.safePlaces],
    ["Lighting", route.breakdown.lighting],
    ["Recent crime", route.breakdown.crime],
    ["Community reports", route.breakdown.community],
    ["Connectivity", route.breakdown.connectivity]
  ];

  for (const [label, value] of scoreItems) {
    const item =
      element(
        "div",
        "",
        `score-item ${value > 0 && label !== "Starting score" ? "positive" : value < 0 ? "negative" : ""}`
      );

    item.append(
      element("span", label),
      element(
        "strong",
        label === "Starting score"
          ? String(value)
          : signedScore(value)
      )
    );

    scoreGrid.append(item);
  }

  scoreSection.append(
    scoreGrid,
    element(
      "p",
      generateScoreExplanation(route),
      "explanation"
    )
  );

  container.append(scoreSection);

  const placeSection =
    element("section", "", "detail-section");

  placeSection.append(
    element("h3", "Safe places near this route")
  );

  const placeList =
    element("div", "", "place-list");

  const nearbyPlaces =
    routeSafePlaces(route)
      .slice(0, 4);

  if (!nearbyPlaces.length) {
    placeList.append(
      element(
        "p",
        havenKnown
          ? "No mapped Safe Haven candidates were found within 300 m of this route."
          : "Safe-place data is currently unavailable.",
        "data-note"
      )
    );
  }

  for (const item of nearbyPlaces) {
    const current =
      havenStatus(item.place);

    const row =
      element("div", "", "place-row");

    const text =
      element("div");

    text.append(
      element("strong", item.place.name),
      element(
        "small",
        `${pretty(item.place.type)} · ${Math.round(item.routeDistance)} m from route`
      )
    );

    row.append(
      text,
      element(
        "span",
        current.label,
        current.state === "open"
          ? "status-open"
          : current.state === "closed"
            ? "status-closed"
            : "status-unknown"
      )
    );

    placeList.append(row);
  }

  placeSection.append(placeList);
  container.append(placeSection);

  const crimeSection =
    element("section", "", "detail-section");

  crimeSection.append(
    element("h3", "Recent crime near this route")
  );

  const crimeList =
    element("div", "", "crime-list");

  const incidents =
    route.evidence?.crimeIncidents || [];

  if (!incidents.length) {
    crimeList.append(
      element(
        "p",
        route.unknown.includes("crime")
          ? "Current crime data is unavailable for this route."
          : "No classified recent incidents were returned within 150 m of this route.",
        "data-note"
      )
    );
  }

  for (const incident of incidents.slice(0, 6)) {
    const row =
      element("div", "", "crime-row");

    const text =
      element("div");

    text.append(
      element("strong", pretty(incident.type)),
      element(
        "small",
        `${Math.round(incident.routeDistance)} m from route · ${incident.daysAgo === 0 ? "today" : `${incident.daysAgo} day${incident.daysAgo === 1 ? "" : "s"} ago`}`
      )
    );

    row.append(
      text,
      element(
        "span",
        signedScore(incident.points),
        "status-closed"
      )
    );

    crimeList.append(row);
  }

  crimeSection.append(
    crimeList,
    element(
      "p",
      "Crime data uses recent public Atlanta records returned by the existing ArcGIS source. Counts are route context, not a prediction of personal safety.",
      "data-note"
    )
  );

  container.append(crimeSection);

  if (route.dataNotes?.length) {
    const dataSection =
      element("section", "", "detail-section");

    dataSection.append(
      element("h3", "Data notes")
    );

    for (const note of route.dataNotes) {
      dataSection.append(
        element("p", note, "data-note")
      );
    }

    container.append(dataSection);
  }
}


function selectRoute(routeId, shouldScroll = false) {
  if (!scoredRoutes.some(route => route.id === routeId)) {
    return;
  }

  selected = routeId;
  drawRoutes();

  if (shouldScroll) {
    requestAnimationFrame(
      () => {
        $("routes")
          .querySelector(`[data-route-id="${routeId}"]`)
          ?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
          });
      }
    );
  }
}


function drawRoutes() {
  const scrollLeft =
    $("routes").scrollLeft;

  routeLayer.clearLayers();
  $("routes").replaceChildren();

  scoredRoutes =
    rawRoutes
      .map(
        route =>
          scoreRoute(
            route,
            havens,
            reports,
            route.evidence
          )
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.duration - b.duration
      );

  if (
    !scoredRoutes.some(
      route => route.id === selected
    )
  ) {
    selected =
      scoredRoutes[0]?.id || null;
  }

  $("route-count").textContent =
    `${scoredRoutes.length} ROUTE${scoredRoutes.length === 1 ? "" : "S"}`;

  for (const route of scoredRoutes) {
    const active =
      route.id === selected;

    const line =
      L.polyline(
        route.points,
        {
          color: routeLineColor(route, active),
          weight: active ? 7 : 5,
          opacity: active ? 1 : .72
        }
      )
        .addTo(routeLayer);

    if (active) {
      line.bringToFront();
    }

    line.on(
      "click",
      () => selectRoute(route.id, true)
    );

    const card =
      element(
        "button",
        "",
        `route${active ? " selected" : ""}`
      );

    card.type = "button";
    card.dataset.routeId = route.id;
    card.setAttribute("aria-pressed", String(active));

    const top =
      element("div", "", "route-top");

    top.append(
      element("span", routeDisplayName(route), "route-title")
    );

    const score =
      element("span", String(route.score), "route-score");

    score.append(
      element("small", " /100")
    );

    top.append(score);

    const metrics =
      element("div", "", "metrics");

    metrics.append(
      element(
        "span",
        `${route.nearby} safe place${route.nearby === 1 ? "" : "s"}`,
        "metric-pill"
      ),
      element(
        "span",
        route.connectivity === null
          ? "Connectivity N/A"
          : `Connection ${signedScore(route.connectivity)}`,
        "metric-pill"
      )
    );

    card.append(
      top,
      element("div", routeRecommendation(route), "recommend"),
      element(
        "div",
        `${Math.round(route.duration / 60)} min · ${(route.distance / 1609.344).toFixed(1)} mi`,
        "route-meta"
      ),
      metrics
    );

    card.onclick =
      () => selectRoute(route.id, false);

    $("routes").append(card);
  }

  $("routes").scrollLeft = scrollLeft;

  $("routes-prev").disabled =
    scoredRoutes.length < 2;

  $("routes-next").disabled =
    scoredRoutes.length < 2;

  renderSelectedRouteDetails();
}


// =====================================================
// SAFE HAVEN DISPLAY
// =====================================================

function placePopup(
  place
) {
  const current =
    havenStatus(
      place
    );


  const base =
    trustPoints[
      place.type
    ] ||
    0;


  const container =
    element(
      "div"
    );


  container.append(
    element(
      "strong",
      place.name
    ),

    element(
      "div",
      `${pretty(place.type)} · ${havenCriteriaLabel(place.type)}`
    ),

    element(
      "div",
      `Base +${base} · Current +${current.points}`,
      "small"
    ),

    element(
      "div",
      current.label,
      "small"
    )
  );


  const button =
    element(
      "button",
      "Set as destination"
    );


  button.onclick =
    () => {
      setTarget(
        place.position,
        place.name
      );


      map.closePopup();
    };


  container.append(
    button
  );


  return container;
}


function renderHavens() {
  havenLayer
    .clearLayers();


  $("havens")
    .replaceChildren();


  // Keep this section compact so it does not push route details off-screen.
  // We show a short preview here and keep the full data available on the map.
  $("haven-note")
    .textContent =
      havenKnown
        ? `${havens.length} mapped Safe Haven candidates found. Showing the closest 4 here.`
        : "Live places have not been loaded yet.";


  if (
    !havens.length
  ) {
    $("havens")
      .append(
        element(
          "p",
          havenKnown
            ? "No mapped Safe Haven candidates found nearby."
            : "Find nearby public places to add context to your walk.",
          "small"
        )
      );


    return;
  }


  const sorted =
    [...havens]
      .sort(
        (
          a,
          b
        ) =>
          origin
            ? distance(
                origin,
                a.position
              ) -
              distance(
                origin,
                b.position
              )
            : 0
      );


  sorted.forEach(
    (
      place,
      index
    ) => {
      const current =
        havenStatus(
          place
        );


      L.circleMarker(
        place.position,
        {
          radius:
            8,

          color:
            "white",

          weight:
            2,

          fillColor:
            current.points >
            0
              ? "#217a59"
              : "#83978d",

          fillOpacity:
            1
        }
      )
        .addTo(
          havenLayer
        )
        .bindPopup(
          placePopup(
            place
          )
        );


      if (
        index < 4
      ) {
        const button =
          element(
            "button",
            place.name,
            "haven"
          );


        button.append(
          element(
            "span",
            `${pretty(place.type)} · +${current.points}`
          )
        );


        button.onclick =
          () => {
            map.setView(
              place.position,
              17
            );


            L.popup()
              .setLatLng(
                place.position
              )
              .setContent(
                placePopup(
                  place
                )
              )
              .openOn(
                map
              );
          };


        $("havens")
          .append(
            button
          );
      }
    }
  );
}


// =====================================================
// COMMUNITY REPORT DISPLAY
// =====================================================

function renderReports() {
  reportLayer
    .clearLayers();


  for (
    const report of
      reports
  ) {
    const box =
      element(
        "div"
      );


    box.append(
      element(
        "strong",
        pretty(
          report.type
        )
      ),

      element(
        "p",
        report.note ||
        ""
      )
    );


    L.circleMarker(
      report.position,
      {
        radius:
          7,

        color:
          "white",

        weight:
          2,

        fillColor:
          "#cf913d",

        fillOpacity:
          1
      }
    )
      .addTo(
        reportLayer
      )
      .bindPopup(
        box
      );
  }
}


// =====================================================
// SAFE HAVEN API
// =====================================================

const havenCache =
  new Map();


const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",

  "https://overpass.private.coffee/api/interpreter"
];


async function runOverpass(
  query
) {
  let lastError =
    null;


  for (
    const server of
      OVERPASS_SERVERS
  ) {
    try {
      console.log(
        "Trying Safe Haven server:",
        server
      );


      const response =
        await fetch(
          server,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8"
            },

            body:
              new URLSearchParams({
                data:
                  query
              }),

            signal:
              AbortSignal.timeout(
                18000
              )
          }
        );


      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      if (
        !Array.isArray(
          data.elements
        )
      ) {
        throw new Error(
          "Invalid Safe Haven response"
        );
      }


      return data;
    }

    catch (
      error
    ) {
      console.warn(
        "Safe Haven server failed:",
        server,
        error
      );


      lastError =
        error;
    }
  }


  throw (
    lastError ||
    new Error(
      "All Safe Haven services failed."
    )
  );
}


function parseHavens(
  data
) {
  const places =
    [];


  const seen =
    new Set();


  for (
    const item of
      data.elements
  ) {
    const lat =
      item.lat ??
      item.center?.lat;


    const lng =
      item.lon ??
      item.center?.lon;


    if (
      !Number.isFinite(
        lat
      ) ||
      !Number.isFinite(
        lng
      )
    ) {
      continue;
    }


    const tags =
      item.tags ||
      {};


    const type =
      placeType(
        tags
      );


    if (
      !type
    ) {
      continue;
    }


    const id =
      `${item.type}-${item.id}`;


    if (
      seen.has(
        id
      )
    ) {
      continue;
    }


    seen.add(
      id
    );


    places.push({
      id,

      name:
        tags.name ||
        pretty(
          type
        ),

      type,

      hours:
        tags.opening_hours,

      access:
        tags.access,

      position: [
        lat,
        lng
      ]
    });
  }


  return places;
}


async function loadHavens(
  center
) {
  const [
    lat,
    lng
  ] =
    center;


  const cacheKey =
    `${lat.toFixed(4)},${lng.toFixed(4)}`;


  if (
    havenCache.has(
      cacheKey
    )
  ) {
    return havenCache.get(
      cacheKey
    );
  }


  const radius =
    2500;


  const query = `
[out:json][timeout:15];

(
  nwr["amenity"="police"](around:${radius},${lat},${lng});
  nwr["amenity"="fire_station"](around:${radius},${lat},${lng});
  nwr["amenity"="hospital"](around:${radius},${lat},${lng});
  nwr["amenity"="clinic"](around:${radius},${lat},${lng});
  nwr["amenity"="library"](around:${radius},${lat},${lng});
  nwr["amenity"="community_centre"](around:${radius},${lat},${lng});
  nwr["amenity"="pharmacy"](around:${radius},${lat},${lng});
  nwr["healthcare"="urgent_care"](around:${radius},${lat},${lng});
  nwr["office"="government"](around:${radius},${lat},${lng});
  nwr["tourism"="hotel"](around:${radius},${lat},${lng});
  nwr["shop"="supermarket"](around:${radius},${lat},${lng});
);

out center tags;
`;


  const data =
    await runOverpass(
      query
    );


  const places =
    parseHavens(
      data
    );


  havenCache.set(
    cacheKey,
    places
  );


  return places;
}


// =====================================================
// LOCATION
// =====================================================

function locate() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        !navigator.geolocation
      ) {
        reject(
          new Error(
            "Location is unavailable."
          )
        );


        return;
      }


      navigator.geolocation
        .getCurrentPosition(
          position => {
            resolve([
              position.coords
                .latitude,

              position.coords
                .longitude
            ]);
          },


          () => {
            reject(
              new Error(
                "Location permission was denied or unavailable."
              )
            );
          },


          {
            enableHighAccuracy:
              true,

            timeout:
              12000,

            maximumAge:
              30000
          }
        );
    }
  );
}


function updateOrigin(
  point
) {
  origin =
    point;


  originMarker
    .setLatLng(
      point
    )
    .addTo(
      map
    );


  $("origin")
    .value =
      "Your current location";


  map.setView(
    point,
    15
  );
}


async function useCurrentLocation() {
  try {
    status(
      "Finding your location..."
    );


    const point =
      await locate();


    updateOrigin(
      point
    );


    status(
      "Location ready. Search for a destination."
    );
  }

  catch (
    error
  ) {
    status(
      error.message
    );
  }
}


// =====================================================
// DESTINATION SEARCH
// =====================================================

$("search-form")
  .onsubmit =
    async event => {
      event
        .preventDefault();


      const query =
        $("destination")
          .value
          .trim();


      if (
        query.length <
        3
      ) {
        status(
          "Enter at least 3 characters."
        );


        return;
      }


      if (
        Date.now() -
          lastSearch <
        1100
      ) {
        status(
          "Please wait a moment before searching again."
        );


        return;
      }


      lastSearch =
        Date.now();


      $("search-results")
        .replaceChildren();


      status(
        "Searching OpenStreetMap..."
      );


      try {
        const data =
          await request(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
          );


        for (
          const place of
            data
        ) {
          const button =
            element(
              "button",
              place.display_name
            );


          button.onclick =
            () => {
              setTarget(
                [
                  Number(
                    place.lat
                  ),

                  Number(
                    place.lon
                  )
                ],

                place.display_name
              );


              $("search-results")
                .replaceChildren();


              map.setView(
                target,
                15
              );
            };


          $("search-results")
            .append(
              button
            );
        }


        status(
          data.length
            ? "Choose a destination."
            : "No destination found."
        );
      }

      catch (
        error
      ) {
        status(
          `Search unavailable: ${error.message}`
        );
      }
    };


// =====================================================
// ROUTING
// =====================================================

const walkingCache =
  new Map();


let lastWalkingRequest =
  0;


async function routeRequest(
  points,
  sessionKey = ""
) {
  const coordinates =
    points.map(
      point => [
        point[1],
        point[0]
      ]
    );


  const cacheId =
    JSON.stringify(
      [
        sessionKey
          ? "ors"
          : "public",

        coordinates
      ]
    );


  if (
    walkingCache.has(
      cacheId
    )
  ) {
    return walkingCache.get(
      cacheId
    );
  }


  const delay =
    Math.max(
      0,

      1100 -
      (
        Date.now() -
        lastWalkingRequest
      )
    );


  if (
    delay
  ) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          delay
        )
    );
  }


  lastWalkingRequest =
    Date.now();


  let result;


  if (
    sessionKey
  ) {
    const body = {
      coordinates,

      instructions:
        false
    };


    if (
      points.length ===
      2
    ) {
      body.alternative_routes = {
        target_count:
          3,

        share_factor:
          0.4,

        weight_factor:
          1.6
      };
    }


    result =
      await request(
        "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
        {
          method:
            "POST",

          headers: {
            Authorization:
              sessionKey,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              body
            )
        }
      );
  }

  else {
    const path =
      coordinates
        .map(
          point =>
            point.join(
              ","
            )
        )
        .join(
          ";"
        );


    const data =
      await request(
        `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${path}?alternatives=3&overview=full&geometries=geojson&steps=false`
      );


    if (
      !data.routes?.length
    ) {
      throw new Error(
        "No walking route was found."
      );
    }


    result = {
      features:
        data.routes.map(
          route => ({
            geometry:
              route.geometry,

            properties: {
              summary: {
                distance:
                  route.distance,

                duration:
                  route.duration
              }
            }
          })
        )
    };
  }


  walkingCache.set(
    cacheId,
    result
  );


  return result;
}


async function findWalkingRoutes(
  from,
  to,
  version,
  sessionKey
) {
  const initial =
    await routeRequest(
      [
        from,
        to
      ],
      sessionKey
    );


  const candidates = [
    ...(
      initial.features ||
      []
    )
  ];


  let chosen =
    distinctRoutes(
      candidates
    );


  for (
    const waypoint of
      detourPoints(
        from,
        to
      )
  ) {
    if (
      version !==
        revision ||
      chosen.length >=
        5
    ) {
      break;
    }


    try {
      const extra =
        await routeRequest(
          [
            from,
            waypoint,
            to
          ],
          sessionKey
        );


      candidates.push(
        ...(
          extra.features ||
          []
        )
      );


      chosen =
        distinctRoutes(
          candidates
        );
    }

    catch {}
  }


  return chosen;
}


// =====================================================
// PLAN ROUTES
// =====================================================

$("plan")
  .onclick =
    async () => {
      if (
        !origin
      ) {
        status(
          "Your current location is not ready."
        );


        return;
      }


      if (
        !target
      ) {
        status(
          "Choose a destination first."
        );


        return;
      }


      if (
        distance(
          origin,
          target
        ) >
        15000
      ) {
        status(
          "Choose a destination within 15 km for this MVP."
        );


        return;
      }


      invalidate();


      const version =
        revision;


      $("plan")
        .disabled =
          true;


      status(
        "Finding walking routes..."
      );


      try {
        const features =
          await findWalkingRoutes(
            origin,
            target,
            version,
            key
          );


        // ==============================================
        // CREATE ROUTES + CONNECTIVITY SCORE
        // ==============================================

        rawRoutes =
          features
            .slice(
              0,
              5
            )
            .map(
              (
                feature,
                index
              ) => {
                const points =
                  feature.geometry
                    .coordinates
                    .map(
                      point => [
                        point[1],
                        point[0]
                      ]
                    );


                const connection =
                  routeConnectivity({
                    points
                  });


                return {
                  id:
                    `route-${index}`,

                  name:
                    `Walking route ${index + 1}`,

                  points,

                  distance:
                    feature.properties
                      .summary
                      .distance,

                  duration:
                    feature.properties
                      .summary
                      .duration,

                  evidence: {
                    connectivityPoints:
                      connection.points
                  },

                  dataNotes: [
                    connection.note,

                    "Connectivity is synthetic demo data, not official Cox coverage."
                  ]
                };
              }
            );


        if (
          !rawRoutes.length
        ) {
          throw new Error(
            "No routes found."
          );
        }


        status(
          "Routes found. Loading Safe Havens..."
        );


        try {
          havens =
            await loadHavens(
              origin
            );


          havenKnown =
            true;
        }

        catch (
          error
        ) {
          console.error(
            "Safe Haven error:",
            error
          );


          havens =
            [];


          havenKnown =
            false;
        }


        renderHavens();


        status(
          "Checking lighting and crime..."
        );


        // Preserve synthetic connectivity while adding
        // crime/streetlight evidence.
        try {
          const previousRoutes =
            rawRoutes;


          const enriched =
            await loadRouteEvidence(
              rawRoutes
            );


          rawRoutes =
            enriched.map(
              (
                route,
                index
              ) => {
                const original =
                  previousRoutes[
                    index
                  ];


                return {
                  ...route,

                  evidence: {
                    ...route.evidence,

                    connectivityPoints:
                      original
                        ?.evidence
                        ?.connectivityPoints ??
                      0
                  },

                  dataNotes: [
                    ...(
                      route.dataNotes ||
                      []
                    ),

                    ...(
                      original
                        ?.dataNotes ||
                      []
                    )
                  ]
                };
              }
            );
        }

        catch (
          error
        ) {
          console.warn(
            "Lighting/crime lookup failed:",
            error
          );
        }


        selected =
          null;


        drawRoutes();


        map.fitBounds(
          L.latLngBounds(
            rawRoutes.flatMap(
              route =>
                route.points
            )
          ),
          {
            padding: [
              55,
              90
            ]
          }
        );


        status(
          `${rawRoutes.length} route(s) ready. Connectivity uses synthetic Georgia demo data.`
        );
      }

      catch (
        error
      ) {
        console.error(
          error
        );


        status(
          `Route failed: ${error.message}`
        );
      }

      finally {
        $("plan")
          .disabled =
            false;
      }
    };


// =====================================================
// REFRESH SAFE HAVENS
// =====================================================

$("refresh-havens")
  .onclick =
    async () => {
      if (
        !origin
      ) {
        status(
          "Current location is unavailable."
        );


        return;
      }


      $("refresh-havens")
        .disabled =
          true;


      status(
        "Searching for Safe Havens..."
      );


      try {
        havenCache
          .clear();


        havens =
          await loadHavens(
            origin
          );


        havenKnown =
          true;


        renderHavens();


        if (
          rawRoutes.length
        ) {
          drawRoutes();
        }


        status(
          `Found ${havens.length} mapped Safe Haven candidates.`
        );
      }

      catch (
        error
      ) {
        console.error(
          error
        );


        havenKnown =
          false;


        status(
          `Safe Haven lookup failed: ${error.message}`
        );
      }

      finally {
        $("refresh-havens")
          .disabled =
            false;
      }
    };


// =====================================================
// COMMUNITY REPORT FORM
// =====================================================

$("report-button")
  .onclick =
    () => {
      if (
        !reportPoint &&
        !origin
      ) {
        status(
          "Click the map or enable location first."
        );


        return;
      }


      $("report-position")
        .textContent =
          `Report location: ${(reportPoint || origin)
            .map(
              number =>
                number.toFixed(
                  5
                )
            )
            .join(", ")}`;


      $("report-dialog")
        .showModal();
    };


$("report-form")
  .onsubmit =
    event => {
      event
        .preventDefault();


      const next = [
        ...reports,

        {
          id:
            crypto.randomUUID(),

          position: [
            ...(
              reportPoint ||
              origin
            )
          ],

          type:
            $("report-type")
              .value,

          note:
            $("report-note")
              .value
              .trim(),

          created:
            Date.now()
        }
      ]
        .slice(
          -100
        );


      localStorage.setItem(
        "saferoute-reports",
        JSON.stringify(
          next
        )
      );


      reports =
        next;


      $("report-dialog")
        .close();


      $("report-note")
        .value =
          "";


      renderReports();


      if (
        rawRoutes.length
      ) {
        drawRoutes();
      }


      status(
        "Community report saved locally."
      );
    };


// =====================================================
// RECENTER
// =====================================================

$("fit")
  .onclick =
    () => {
      if (
        rawRoutes.length
      ) {
        map.fitBounds(
          L.latLngBounds(
            rawRoutes.flatMap(
              route =>
                route.points
            )
          ),
          {
            padding: [
              55,
              90
            ]
          }
        );
      }

      else if (
        origin
      ) {
        map.setView(
          origin,
          15
        );
      }
    };


// =====================================================
// SETTINGS
// =====================================================

$("settings-button")
  .onclick =
    () =>
      $("settings-dialog")
        .showModal();


$("save-settings")
  .onclick =
    () => {
      key =
        $("api-key")
          .value
          .trim();


      $("api-key")
        .value =
          "";


      status(
        key
          ? "Routing API key set for this session."
          : "Using public walking routes."
      );
    };


document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(
    button => {
      button.onclick =
        () => {
          const dialog =
            $(
              button.dataset.close
            );


          dialog
            ?.close();
        };
    }
  );


// =====================================================
// I FEEL UNSAFE MODE
// =====================================================

function updateUnsafeUI() {
  document.body
    .classList
    .toggle(
      "unsafe-mode",
      unsafeMode
    );

  $("unsafe-actions")
    .setAttribute(
      "aria-hidden",
      String(!unsafeMode)
    );

  $("unsafe-button")
    .setAttribute(
      "aria-pressed",
      String(unsafeMode)
    );

  const label =
    $("unsafe-button")
      .querySelector(
        ".unsafe-fab-label"
      );

  const icon =
    $("unsafe-button")
      .querySelector(
        ".unsafe-fab-icon"
      );

  if (label) {
    label.textContent =
      unsafeMode
        ? "Exit safety mode"
        : "I feel unsafe";
  }

  if (icon) {
    icon.textContent =
      unsafeMode
        ? "×"
        : "◉";
  }

  if (!unsafeMode) {
    $("unsafe-status").textContent = "";
  }
}


function stopAlarm() {
  clearInterval(
    alarmTimer
  );

  alarmTimer =
    null;

  if (
    navigator.vibrate
  ) {
    navigator.vibrate(0);
  }
}


function alarmBeep() {
  try {
    if (!alarmContext) {
      alarmContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
    }

    if (
      alarmContext.state ===
      "suspended"
    ) {
      alarmContext.resume();
    }

    const oscillator =
      alarmContext.createOscillator();

    const gain =
      alarmContext.createGain();

    oscillator.frequency.value =
      880;

    gain.gain.value =
      0.035;

    oscillator
      .connect(gain)
      .connect(
        alarmContext.destination
      );

    oscillator.start();
    oscillator.stop(
      alarmContext.currentTime +
      0.18
    );
  }

  catch (
    error
  ) {
    console.warn(
      "Alarm audio unavailable:",
      error
    );
  }
}


function startAlarm() {
  stopAlarm();
  alarmBeep();

  alarmTimer =
    setInterval(
      alarmBeep,
      900
    );

  if (
    navigator.vibrate
  ) {
    navigator.vibrate([
      350,
      180,
      350,
      180,
      700
    ]);
  }
}


function closeSafetyCheck() {
  clearInterval(
    safetyCountdownTimer
  );

  safetyCountdownTimer =
    null;

  demoSafetyCheckActive =
    false;

  stopAlarm();

  if (
    $("safety-check-dialog").open
  ) {
    $("safety-check-dialog")
      .close();
  }
}


// Open the device's emergency calling flow immediately.
// SafeRoute does NOT show its own confirmation here. A mobile OS/browser
// can still show a system-level confirmation and we cannot remove that.
function attemptEmergencyCall({
  keepAlarm = false
} = {}) {
  if (!keepAlarm) {
    closeSafetyCheck();
  }

  $("unsafe-status").textContent =
    "Opening the phone emergency calling flow…";

  // Using one constant makes this easy to replace with a test number
  // during development without hunting through the file.
  window.location.href =
    EMERGENCY_CALL_URI;
}


// Manual Call 911 button still uses a confirmation dialog so an accidental
// tap does not open the emergency dialer. Automatic inactivity timeouts do
// NOT use this dialog.
function showEmergencyConfirmation() {
  if (
    !$("emergency-dialog").open
  ) {
    $("emergency-dialog")
      .showModal();
  }
}


// This is the automatic timeout path used by BOTH:
//   1) the real 5-minute I Feel Unsafe timer, and
//   2) the 10-second hackathon demo timer.
// It starts the alarm first, then immediately attempts tel:911. There is no
// "Are you safe?" countdown in this path anymore.
function triggerInactivityEmergency({
  demo = false
} = {}) {
  if (!unsafeMode) {
    return;
  }

  startAlarm();

  $("unsafe-status").textContent =
    demo
      ? "DEMO: 10 seconds passed · alarm active · opening 911 call flow"
      : "No meaningful movement detected · alarm active · opening 911 call flow";

  // Give the alarm a very short head start so the demo visibly/audibly
  // triggers before the browser switches to the phone handler.
  window.setTimeout(
    () => {
      if (!unsafeMode) {
        return;
      }

      attemptEmergencyCall({
        keepAlarm: true
      });
    },
    250
  );

  // If a desktop browser has no tel: handler and stays on this page,
  // automatically stop the beeping after 15 seconds.
  window.setTimeout(
    () => stopAlarm(),
    15000
  );
}


// Kept as a small wrapper because older UI code/tests may still reference
// showSafetyCheck(). It now goes directly to the automatic emergency flow.
function showSafetyCheck(
  options = {}
) {
  triggerInactivityEmergency({
    demo: Boolean(options.demo)
  });
}


function resetInactivityTimer() {
  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  if (!unsafeMode) {
    return;
  }

  inactivityTimer =
    setTimeout(
      () =>
        triggerInactivityEmergency({
          demo: false
        }),
      UNSAFE_INACTIVITY_TIME
    );
}


function handleSafetyPosition(
  position
) {
  if (!unsafeMode) {
    return;
  }

  const current = [
    position.coords.latitude,
    position.coords.longitude
  ];

  originMarker
    .setLatLng(current)
    .addTo(map);

  if (!safetyLastPosition) {
    safetyLastPosition =
      current;

    resetInactivityTimer();

    return;
  }

  const moved =
    distance(
      safetyLastPosition,
      current
    );

  if (
    moved >=
    MOVEMENT_THRESHOLD_METERS
  ) {
    safetyLastPosition =
      current;

    resetInactivityTimer();

    if (
      $("safety-check-dialog").open
    ) {
      closeSafetyCheck();
    }

    $("unsafe-status").textContent =
      `Movement detected · safety timer reset`;
  }
}


function startSafetyTracking() {
  if (
    !navigator.geolocation
  ) {
    $("unsafe-status").textContent =
      "Location monitoring is not supported, so the inactivity timer is paused.";

    return;
  }

  if (
    safetyWatchId !== null
  ) {
    navigator.geolocation
      .clearWatch(
        safetyWatchId
      );
  }

  safetyLastPosition =
    null;

  safetyWatchId =
    navigator.geolocation
      .watchPosition(
        handleSafetyPosition,
        error => {
          console.warn(
            "Safety location error:",
            error
          );

          clearTimeout(
            inactivityTimer
          );

          inactivityTimer =
            null;

          $("unsafe-status").textContent =
            "Location monitoring is unavailable, so the inactivity timer is paused.";
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000
        }
      );
}


function stopSafetyTracking() {
  if (
    safetyWatchId !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation
      .clearWatch(
        safetyWatchId
      );
  }

  safetyWatchId =
    null;

  safetyLastPosition =
    null;

  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  closeSafetyCheck();
}


function setSheetExpanded(
  expanded
) {
  const sheet =
    $("route-options");

  sheet
    .classList
    .toggle(
      "expanded",
      expanded
    );

  $("sheet-handle")
    .setAttribute(
      "aria-expanded",
      String(expanded)
    );
}


function stopDemoAlarm() {
  clearTimeout(
    demoAlarmTimer
  );

  demoAlarmTimer =
    null;

  const button =
    $("demo-alarm-button");

  if (button) {
    button.disabled =
      false;

    button.classList
      .remove("running");

    button.innerHTML =
      '<span aria-hidden="true">▶</span><strong>Demo 10s</strong>';
  }
}


// Return the best position we already know WITHOUT waiting for a new GPS fix.
// This makes the Safe Place button feel immediate after a route has already
// been planned or safety tracking has already received a location update.
function currentSafetyReferencePoint() {
  if (safetyLastPosition) {
    return safetyLastPosition;
  }

  if (origin) {
    return origin;
  }

  return null;
}


// Pick a Safe Haven quickly from data that is already in memory.
// Priority:
//   1) confirmed open places (for example 24/7),
//   2) places whose hours are unknown but are NOT confirmed closed,
// while always excluding restricted/private places through havenStatus().
function chooseNearestUsableHaven(
  point,
  places = havens
) {
  const usable =
    places
      .map(place => ({
        place,
        status: havenStatus(place)
      }))
      .filter(item =>
        item.status.label !== "Restricted access" &&
        item.status.state !== "closed"
      )
      .sort((a, b) => {
        // Confirmed-open places should win over unknown-hours places.
        const aOpen = a.status.state === "open" ? 0 : 1;
        const bOpen = b.status.state === "open" ? 0 : 1;

        if (aOpen !== bOpen) {
          return aOpen - bOpen;
        }

        return (
          distance(point, a.place.position) -
          distance(point, b.place.position)
        );
      });

  return usable[0] || null;
}


// Immediately show the chosen Safe Haven on the map BEFORE route fetching.
// The route API can take a moment, but the user should see which place was
// selected right away.
function showSafeHavenImmediately(
  point,
  chosen
) {
  const { place, status: placeStatus } =
    chosen;

  updateOrigin(point);
  setTarget(
    place.position,
    place.name
  );

  map.setView(
    place.position,
    16
  );

  // targetMarker is created by setTarget(). Open its popup immediately so
  // the Safe Place action has instant visual feedback.
  targetMarker?.openPopup();

  const distanceMiles =
    distance(point, place.position) /
    1609.344;

  const hoursText =
    placeStatus.state === "open"
      ? "confirmed open"
      : "hours not confirmed";

  $("unsafe-status").textContent =
    `${place.name} · ${distanceMiles.toFixed(1)} mi · ${hoursText} · calculating route…`;
}


// Start loading Safe Havens in the background as soon as safety mode starts.
// This usually makes the later Safe Place button almost instant.
async function prefetchSafeHavensForSafety() {
  const point =
    currentSafetyReferencePoint();

  if (!point || havens.length) {
    return;
  }

  try {
    havens =
      await loadHavens(point);

    havenKnown =
      true;

    renderHavens();
  }
  catch (error) {
    // Prefetch failure should not interrupt safety mode. The Safe Place
    // button will make another attempt if the user actually presses it.
    console.warn(
      "Safe Haven prefetch failed:",
      error
    );
  }
}


function startDemoAlarm() {
  if (!unsafeMode) {
    enterUnsafeMode();
  }

  stopDemoAlarm();

  const button =
    $("demo-alarm-button");

  button.disabled =
    true;

  button.classList
    .add("running");

  button.innerHTML =
    '<span aria-hidden="true">●</span><strong>Alarm in 10s</strong>';

  $("unsafe-status").textContent =
    "DEMO active · safety alarm will trigger in 10 seconds";

  demoAlarmTimer =
    setTimeout(
      () => {
        demoAlarmTimer =
          null;

        if (!unsafeMode) {
          stopDemoAlarm();
          return;
        }

        if (button) {
          button.disabled =
            false;

          button.classList
            .remove("running");

          button.innerHTML =
            '<span aria-hidden="true">▶</span><strong>Demo 10s</strong>';
        }

        // Demo path: 10 seconds -> alarm -> immediate 911 call attempt.
        triggerInactivityEmergency({
          demo: true
        });
      },
      DEMO_ALARM_DELAY
    );
}


function enterUnsafeMode() {
  if (unsafeMode) {
    return;
  }

  unsafeMode =
    true;

  setSheetExpanded(false);
  updateUnsafeUI();

  // Create/resume the audio context from a user gesture so
  // a later safety alarm has the best chance of being audible.
  try {
    if (!alarmContext) {
      alarmContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
    }

    alarmContext.resume?.();
  }
  catch {}

  startSafetyTracking();

  // Do this in the background now so Safe Place can respond immediately
  // when the user needs it.
  prefetchSafeHavensForSafety();

  $("unsafe-status").textContent =
    "Safety mode active · movement monitoring started";
}


function exitUnsafeMode() {
  unsafeMode =
    false;

  stopDemoAlarm();
  stopSafetyTracking();
  updateUnsafeUI();
}


$("unsafe-button")
  .onclick =
    () => {
      if (unsafeMode) {
        exitUnsafeMode();
      }
      else {
        enterUnsafeMode();
      }
    };


$("demo-alarm-button")
  .onclick =
    startDemoAlarm;


$("call-911")
  .onclick =
    showEmergencyConfirmation;


$("cancel-911")
  .onclick =
    () =>
      $("emergency-dialog")
        .close();


$("confirm-911")
  .onclick =
    () => {
      $("emergency-dialog")
        .close();

      attemptEmergencyCall();
    };


$("safety-call-911")
  .onclick =
    () =>
      attemptEmergencyCall();


$("im-safe")
  .onclick =
    () => {
      closeSafetyCheck();
      resetInactivityTimer();

      $("unsafe-status").textContent =
        "Safety check cleared · monitoring continues";
    };


$("safety-check-dialog")
  .addEventListener(
    "cancel",
    event => {
      event.preventDefault();
    }
  );


$("nearest")
  .onclick =
    async () => {
      $("nearest").disabled =
        true;

      $("unsafe-status").textContent =
        "Finding the nearest Safe Haven…";

      try {
        // FAST PATH: reuse the latest safety GPS point or the route origin.
        // This avoids waiting up to ~12 seconds for another geolocation call.
        let point =
          currentSafetyReferencePoint();

        // Only request a fresh GPS fix if we truly do not have a usable
        // position yet.
        if (!point) {
          point =
            await locate();
        }

        // First try the Safe Haven data already loaded by route planning or
        // the background prefetch. This makes the button feel immediate.
        let chosen =
          chooseNearestUsableHaven(
            point,
            havens
          );

        // If nothing is cached, fetch live OpenStreetMap/Overpass places once.
        if (!chosen) {
          $("unsafe-status").textContent =
            "Loading nearby Safe Havens…";

          havens =
            await loadHavens(
              point
            );

          havenKnown =
            true;

          renderHavens();

          chosen =
            chooseNearestUsableHaven(
              point,
              havens
            );
        }

        if (!chosen) {
          throw new Error(
            "No nearby Safe Haven was found. Try refreshing Safe Havens or moving the map closer to your location."
          );
        }

        // Show the destination immediately. Route calculation happens next.
        showSafeHavenImmediately(
          point,
          chosen
        );

        // Reuse the project's existing route planner instead of duplicating
        // routing code here.
        $("plan").click();
      }

      catch (
        error
      ) {
        $("unsafe-status").textContent =
          error.message;
      }

      finally {
        $("nearest").disabled =
          false;
      }
    };


// =====================================================
// FAKE CALL — UPLOADED MODULE INTEGRATION
// =====================================================
//
// The fake-call folder is loaded from index.html with:
//   fake-call/fake-call.js
//
// That script exposes window.FakeCall. We hide the module's own floating
// button and reuse SafeRoute's Fake Call button inside I Feel Unsafe mode.
// This keeps the UI consistent while still using the uploaded caller picker,
// ringtone, full-screen phone UI, and pre-generated ElevenLabs audio clips.

$("fake-call")
  .onclick =
    () => {
      if (
        window.FakeCall &&
        typeof window.FakeCall.open === "function"
      ) {
        // Opens the module's sheet where the user can choose Mom / Alex / Sam
        // and whether the fake call should ring now or after a short delay.
        window.FakeCall.open();

        $("unsafe-status").textContent =
          "Choose who should fake-call you.";

        return;
      }

      // This normally means fake-call/fake-call.js or scripts.json did not load.
      console.error(
        "Fake Call module is unavailable. Check the fake-call/ folder and browser console."
      );

      $("unsafe-status").textContent =
        "Fake Call could not load. Check the fake-call folder.";
    };


// The fake-call module emits this event whenever its state changes.
// We use it only to reflect the state inside SafeRoute's safety-mode status.
window.addEventListener(
  "fakecall",
  event => {
    const phase =
      event.detail?.phase;

    const persona =
      event.detail?.persona;

    const names = {
      mom: "Mom",
      friend: "Alex",
      roommate: "Sam"
    };

    const callerName =
      names[persona] ||
      "Fake caller";

    if (phase === "scheduled") {
      $("unsafe-status").textContent =
        `${callerName} call scheduled.`;
    }
    else if (phase === "ringing") {
      $("unsafe-status").textContent =
        `${callerName} is calling…`;
    }
    else if (phase === "active") {
      $("unsafe-status").textContent =
        `Fake call with ${callerName} is active.`;
    }
    else if (phase === "ended" || phase === "idle") {
      if (unsafeMode) {
        $("unsafe-status").textContent =
          "I Feel Unsafe mode is active.";
      }
    }
  }
);


// =====================================================
// ROUTE BOTTOM SHEET
// =====================================================

const routeSheet =
  $("route-options");

const sheetHandle =
  $("sheet-handle");

let sheetDragStartY =
  0;

let sheetDragStartOffset =
  0;

let sheetDragging =
  false;


function sheetCollapsedOffset() {
  const collapsed =
    parseFloat(
      getComputedStyle(
        document.documentElement
      )
        .getPropertyValue(
          "--sheet-collapsed"
        )
    ) ||
    198;

  return Math.max(
    0,
    routeSheet
      .getBoundingClientRect()
      .height -
      collapsed
  );
}


function applySheetDrag(
  offset
) {
  const clamped =
    Math.max(
      0,
      Math.min(
        sheetCollapsedOffset(),
        offset
      )
    );

  const desktop =
    window.matchMedia(
      "(min-width: 900px)"
    ).matches;

  routeSheet.style.transform =
    desktop
      ? `translate(0, ${clamped}px)`
      : `translate(-50%, ${clamped}px)`;
}


sheetHandle
  .addEventListener(
    "pointerdown",
    event => {
      sheetDragging =
        true;

      sheetDragStartY =
        event.clientY;

      sheetDragStartOffset =
        routeSheet.classList
          .contains("expanded")
          ? 0
          : sheetCollapsedOffset();

      routeSheet.classList
        .add("dragging");

      sheetHandle
        .setPointerCapture(
          event.pointerId
        );
    }
  );


sheetHandle
  .addEventListener(
    "pointermove",
    event => {
      if (!sheetDragging) {
        return;
      }

      applySheetDrag(
        sheetDragStartOffset +
        event.clientY -
        sheetDragStartY
      );
    }
  );


function finishSheetDrag(
  event
) {
  if (!sheetDragging) {
    return;
  }

  sheetDragging =
    false;

  routeSheet.classList
    .remove("dragging");

  const movement =
    event.clientY -
    sheetDragStartY;

  routeSheet.style.transform =
    "";

  if (
    Math.abs(movement) < 12
  ) {
    setSheetExpanded(
      !routeSheet.classList
        .contains("expanded")
    );
  }
  else {
    setSheetExpanded(
      movement < 0
    );
  }
}


sheetHandle
  .addEventListener(
    "pointerup",
    finishSheetDrag
  );


sheetHandle
  .addEventListener(
    "pointercancel",
    finishSheetDrag
  );


sheetHandle
  .addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        setSheetExpanded(
          !routeSheet.classList
            .contains("expanded")
        );
      }
    }
  );


let routeScrollTimer =
  null;


$("routes")
  .addEventListener(
    "scroll",
    () => {
      clearTimeout(
        routeScrollTimer
      );

      routeScrollTimer =
        setTimeout(
          () => {
            const container =
              $("routes");

            const center =
              container.scrollLeft +
              container.clientWidth / 2;

            const cards = [
              ...container.children
            ];

            const nearestCard =
              cards
                .map(
                  card => ({
                    card,
                    distance:
                      Math.abs(
                        card.offsetLeft +
                        card.offsetWidth / 2 -
                        center
                      )
                  })
                )
                .sort(
                  (a, b) =>
                    a.distance -
                    b.distance
                )[0]
                ?.card;

            if (
              nearestCard &&
              nearestCard.dataset.routeId !==
              selected
            ) {
              selectRoute(
                nearestCard.dataset.routeId,
                false
              );
            }
          },
          130
        );
    },
    { passive: true }
  );


// =====================================================
// ROUTE SCROLL BUTTONS
// =====================================================

for (
  const [
    id,
    direction
  ] of [
    [
      "routes-prev",
      -1
    ],

    [
      "routes-next",
      1
    ]
  ]
) {
  $(id)
    .onclick =
      () => {
        const card =
          $("routes")
            .firstElementChild;


        if (
          card
        ) {
          $("routes")
            .scrollBy({
              left:
                direction *
                (
                  card
                    .getBoundingClientRect()
                    .width +
                  12
                ),

              behavior:
                "smooth"
            });
        }
      };
}


// =====================================================
// START
// =====================================================

renderConnectivityZones();

renderHavens();

renderReports();

drawRoutes();

setLive();

useCurrentLocation();