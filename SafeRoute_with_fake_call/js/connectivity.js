// ======================================================
// SafeRoute Synthetic Connectivity Database
// ======================================================
//
// HACKATHON DEMO DATA ONLY.
//
// This is NOT official Cox coverage.
//
// Each geographic cell has an integer connectivity score:
//
//  +10 = Excellent
//    0 = Average
//  -10 = Very Poor
//
// ======================================================


// ------------------------------------------------------
// APPROXIMATE GEORGIA BORDER
// ------------------------------------------------------

const GEORGIA_POLYGON = [
  [35.000, -85.605],
  [35.000, -83.108],

  [34.990, -83.000],
  [34.800, -82.900],
  [34.500, -82.700],
  [34.100, -82.500],

  [33.700, -82.200],
  [33.300, -81.900],
  [32.800, -81.500],
  [32.300, -81.200],

  [31.700, -81.100],
  [31.100, -81.500],

  [30.700, -82.000],
  [30.360, -82.200],

  [30.360, -84.900],

  [31.000, -85.000],
  [32.000, -85.000],
  [33.000, -85.200],
  [34.000, -85.400],

  [35.000, -85.605]
];


// ------------------------------------------------------
// CITY INFLUENCES
// ------------------------------------------------------
//
// These do NOT force the whole city to be green.
// They only increase the probability of stronger cells.
//

const hubs = [
  // ------------------------
  // Dense urban / downtown
  // ------------------------
  {
    name: "Downtown Atlanta",
    lat: 33.7490,
    lng: -84.3880,
    strength: 8.8,
    radius: 24000,
    kind: "urban"
  },
  {
    name: "Midtown",
    lat: 33.7810,
    lng: -84.3874,
    strength: 8.4,
    radius: 16000,
    kind: "urban"
  },
  {
    name: "Buckhead",
    lat: 33.8484,
    lng: -84.3733,
    strength: 7.2,
    radius: 15000,
    kind: "urban"
  },
  {
    name: "Decatur",
    lat: 33.7748,
    lng: -84.2963,
    strength: 5.8,
    radius: 12000,
    kind: "urban"
  },
  {
    name: "Sandy Springs",
    lat: 33.9304,
    lng: -84.3733,
    strength: 6.2,
    radius: 14000,
    kind: "urban"
  },
  {
    name: "Marietta",
    lat: 33.9526,
    lng: -84.5499,
    strength: 5.5,
    radius: 12000,
    kind: "urban"
  },
  {
    name: "Alpharetta",
    lat: 34.0754,
    lng: -84.2941,
    strength: 5.8,
    radius: 12000,
    kind: "urban"
  },
  {
    name: "Athens",
    lat: 33.9519,
    lng: -83.3576,
    strength: 7.2,
    radius: 17000,
    kind: "urban"
  },
  {
    name: "Augusta",
    lat: 33.4735,
    lng: -82.0105,
    strength: 6.0,
    radius: 17000,
    kind: "urban"
  },
  {
    name: "Savannah",
    lat: 32.0809,
    lng: -81.0912,
    strength: 6.4,
    radius: 17000,
    kind: "urban"
  },
  {
    name: "Macon",
    lat: 32.8407,
    lng: -83.6324,
    strength: 5.6,
    radius: 16000,
    kind: "urban"
  },
  {
    name: "Columbus",
    lat: 32.4609,
    lng: -84.9877,
    strength: 5.6,
    radius: 16000,
    kind: "urban"
  },

  // ------------------------
  // Universities / campuses
  // These are intentional because you asked for stronger
  // connectivity around universities and similar dense areas.
  // ------------------------
  {
    name: "Georgia Tech",
    lat: 33.7756,
    lng: -84.3963,
    strength: 5.4,
    radius: 7000,
    kind: "campus"
  },
  {
    name: "Georgia State",
    lat: 33.7530,
    lng: -84.3853,
    strength: 4.8,
    radius: 6500,
    kind: "campus"
  },
  {
    name: "Morehouse College",
    lat: 33.7488,
    lng: -84.4144,
    strength: 4.6,
    radius: 5500,
    kind: "campus"
  },
  {
    name: "Spelman College",
    lat: 33.7452,
    lng: -84.4110,
    strength: 4.6,
    radius: 5500,
    kind: "campus"
  },
  {
    name: "Clark Atlanta University",
    lat: 33.7501,
    lng: -84.4120,
    strength: 4.6,
    radius: 5500,
    kind: "campus"
  },
  {
    name: "Emory",
    lat: 33.7925,
    lng: -84.3238,
    strength: 4.8,
    radius: 7000,
    kind: "campus"
  },
  {
    name: "University of Georgia",
    lat: 33.9480,
    lng: -83.3773,
    strength: 4.6,
    radius: 7500,
    kind: "campus"
  },
  {
    name: "Kennesaw State",
    lat: 34.0380,
    lng: -84.5820,
    strength: 4.2,
    radius: 7000,
    kind: "campus"
  },
  {
    name: "Georgia Southern",
    lat: 32.4245,
    lng: -81.7799,
    strength: 4.0,
    radius: 7000,
    kind: "campus"
  },

  // ------------------------
  // Residential / mixed-use areas
  // These help create stronger but not always perfect connectivity
  // in places where many people live.
  // ------------------------
  {
    name: "Virginia-Highland",
    lat: 33.7799,
    lng: -84.3521,
    strength: 3.2,
    radius: 7000,
    kind: "residential"
  },
  {
    name: "Old Fourth Ward",
    lat: 33.7647,
    lng: -84.3731,
    strength: 3.2,
    radius: 7000,
    kind: "residential"
  },
  {
    name: "Atlantic Station",
    lat: 33.7914,
    lng: -84.3973,
    strength: 3.4,
    radius: 6000,
    kind: "residential"
  },
  {
    name: "Duluth",
    lat: 34.0029,
    lng: -84.1446,
    strength: 3.4,
    radius: 8500,
    kind: "residential"
  },
  {
    name: "Johns Creek",
    lat: 34.0289,
    lng: -84.1986,
    strength: 3.5,
    radius: 9000,
    kind: "residential"
  },
  {
    name: "Valdosta",
    lat: 30.8327,
    lng: -83.2785,
    strength: 4.2,
    radius: 13000,
    kind: "urban"
  },
  {
    name: "Rome",
    lat: 34.2570,
    lng: -85.1647,
    strength: 3.8,
    radius: 12000,
    kind: "urban"
  },
  {
    name: "Gainesville",
    lat: 34.2979,
    lng: -83.8241,
    strength: 4.2,
    radius: 13000,
    kind: "urban"
  },
  {
    name: "Auburn-Opelika corridor",
    lat: 32.6099,
    lng: -85.4808,
    strength: 2.2,
    radius: 9000,
    kind: "edge"
  }
];


// ------------------------------------------------------
// DISTANCE
// ------------------------------------------------------

function distanceMeters(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const R = 6371000;

  const rad =
    Math.PI / 180;

  const dLat =
    (lat2 - lat1) * rad;

  const dLng =
    (lng2 - lng1) * rad;

  const a =
    Math.sin(dLat / 2) ** 2 +

    Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) *

    Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


// ------------------------------------------------------
// POINT INSIDE GEORGIA
// ------------------------------------------------------

function pointInGeorgia(
  lat,
  lng
) {
  let inside =
    false;

  for (
    let i = 0,
      j =
        GEORGIA_POLYGON.length - 1;

    i < GEORGIA_POLYGON.length;

    j = i++
  ) {
    const yi =
      GEORGIA_POLYGON[i][0];

    const xi =
      GEORGIA_POLYGON[i][1];

    const yj =
      GEORGIA_POLYGON[j][0];

    const xj =
      GEORGIA_POLYGON[j][1];


    const intersect =
      (
        yi > lat
      ) !==
      (
        yj > lat
      ) &&

      lng <
        (
          (xj - xi) *
          (lat - yi)
        ) /
        (
          yj - yi ||
          0.000001
        ) +
        xi;


    if (intersect) {
      inside =
        !inside;
    }
  }

  return inside;
}


// ------------------------------------------------------
// DETERMINISTIC RANDOM NUMBER
// ------------------------------------------------------
//
// Unlike Math.random(), this gives the same map
// every time the browser refreshes.
//

function hashNoise(
  lat,
  lng,
  seed
) {
  const value =
    Math.sin(
      lat * 127.1 +
      lng * 311.7 +
      seed * 74.7
    ) *
    43758.5453123;

  return (
    value -
    Math.floor(value)
  );
}


// ------------------------------------------------------
// LOCAL VARIATION
// ------------------------------------------------------

function localVariation(
  lat,
  lng
) {
  const regional =
    hashNoise(
      lat * 0.8,
      lng * 0.8,
      13
    );

  const neighborhood =
    hashNoise(
      lat * 3.1,
      lng * 3.1,
      47
    );

  const streetLevel =
    hashNoise(
      lat * 9.2,
      lng * 9.2,
      91
    );


  return (
    (regional - 0.5) * 5 +

    (neighborhood - 0.5) * 5 +

    (streetLevel - 0.5) * 3
  );
}


// ------------------------------------------------------
// CITY INFLUENCE
// ------------------------------------------------------

function cityInfluence(
  lat,
  lng
) {
  let primary = 0;
  let secondary = 0;
  let neighborhoodBoost = 0;

  for (
    const hub of hubs
  ) {
    const d =
      distanceMeters(
        lat,
        lng,
        hub.lat,
        hub.lng
      );

    if (
      d >
      hub.radius
    ) {
      continue;
    }

    const ratio =
      1 -
      d /
      hub.radius;

    // Smooth falloff keeps the map from becoming giant hard circles.
    const influence =
      hub.strength *
      ratio *
      ratio;

    // Use the strongest hub as the main driver, but also let a second
    // nearby hub contribute a smaller amount. This makes major metro /
    // campus clusters feel more realistic than a single isolated blob.
    if (influence > primary) {
      secondary = primary;
      primary = influence;
    }
    else if (influence > secondary) {
      secondary = influence;
    }

    // Residential and campus areas should feel more connected, but not
    // always perfect, so give them a modest additive boost.
    if (hub.kind === "campus") {
      neighborhoodBoost += influence * 0.22;
    }
    else if (hub.kind === "residential") {
      neighborhoodBoost += influence * 0.16;
    }
  }

  return primary + secondary * 0.35 + neighborhoodBoost;
}


// ------------------------------------------------------
// CAMPUS PROXIMITY
// ------------------------------------------------------
// Returns 0..1 based on how close the point is to the nearest university.
// We keep this separate from cityInfluence() so university demo areas can
// intentionally receive a stronger 5-9 range without turning all of Atlanta
// into a perfect +10 connectivity zone.
function campusProximity(
  lat,
  lng
) {
  let strongest = 0;

  for (const hub of hubs) {
    if (hub.kind !== "campus") {
      continue;
    }

    const d =
      distanceMeters(
        lat,
        lng,
        hub.lat,
        hub.lng
      );

    if (d >= hub.radius) {
      continue;
    }

    const proximity =
      1 - d / hub.radius;

    strongest = Math.max(
      strongest,
      proximity
    );
  }

  return strongest;
}


// ------------------------------------------------------
// CALCULATE SCORE
// ------------------------------------------------------

function calculateConnectivity(
  lat,
  lng
) {
  // Rural baseline. Most of the state should NOT look excellent.
  let score =
    -3.4;

  // Population / business / campus centers raise the score.
  score +=
    cityInfluence(
      lat,
      lng
    );

  // Neighborhood-scale variation keeps adjacent cells different.
  score +=
    localVariation(
      lat,
      lng
    ) * 0.75;

  // Some areas should feel patchy even inside strong regions.
  const weakPocket =
    hashNoise(
      lat * 17,
      lng * 17,
      133
    );

  if (
    weakPocket > 0.93
  ) {
    score -= 5;
  }
  else if (
    weakPocket > 0.84
  ) {
    score -= 2.5;
  }

  // In dense districts there should be some legitimately excellent
  // pockets (for example universities and dense residential areas).
  const hotspot =
    hashNoise(
      lat * 19,
      lng * 19,
      201
    );

  if (
    hotspot > 0.95
  ) {
    score += 4.5;
  }
  else if (
    hotspot > 0.87
  ) {
    score += 2.5;
  }

  // If a place is already urban/campus-heavy, allow it to reach the top end
  // more often. This is what creates 5–10 in strong regions instead of a map
  // where almost nothing ever reaches +10.
  const density =
    cityInfluence(
      lat,
      lng
    );

  if (density > 6.5) {
    score += 2.2;
  }
  else if (density > 4.5) {
    score += 1.1;
  }

  // Force a stronger 5-10 band in dense metro / university / residential
  // areas, while still keeping some local variety.
  const densePattern =
    hashNoise(
      lat * 23,
      lng * 23,
      59
    );

  if (density > 8.5) {
    score = Math.max(
      score,
      5 + Math.round(densePattern * 5)
    );
  }
  else if (density > 6) {
    score = Math.max(
      score,
      4 + Math.round(densePattern * 4)
    );
  }
  else if (density > 4.5) {
    score = Math.max(
      score,
      2 + Math.round(densePattern * 4)
    );
  }

  // ----------------------------------------------------
  // UNIVERSITY-FOCUSED DEMO RANGE
  // ----------------------------------------------------
  // Near a university we intentionally want stronger connectivity, but NOT
  // every cell should be +10. The deterministic pattern below makes nearby
  // campus cells land at different values such as 5, 6, 7, 8, and 9.
  //
  // Core campus area:      5..9
  // Campus edge / nearby:  3..8
  // Outside campus zones:  use the normal city / residential calculation.
  const campus =
    campusProximity(
      lat,
      lng
    );

  const campusPattern =
    hashNoise(
      lat * 31,
      lng * 31,
      317
    );

  if (campus >= 0.25) {
    const campusTarget =
      5 + Math.floor(campusPattern * 5); // exactly 5, 6, 7, 8, or 9

    score = Math.max(
      score,
      campusTarget
    );

    // Cap the university core at 9 so the demo shows meaningful variation
    // instead of visually implying that every campus block is perfect.
    score = Math.min(
      score,
      9
    );
  }
  else if (campus > 0) {
    const campusEdgeTarget =
      3 + Math.floor(campusPattern * 6); // 3..8 around the edge

    score = Math.max(
      score,
      campusEdgeTarget
    );
  }

  // Convert to integer and clamp to the -10..10 scale.
  score =
    Math.round(
      score
    );

  return Math.max(
    -10,
    Math.min(
      10,
      score
    )
  );
}


// ------------------------------------------------------
// LABEL
// ------------------------------------------------------

export function connectionLabel(
  score
) {
  if (score >= 9) {
    return "Excellent";
  }

  if (score >= 7) {
    return "Very Strong";
  }

  if (score >= 5) {
    return "Strong";
  }

  if (score >= 3) {
    return "Good";
  }

  if (score >= 1) {
    return "Fair";
  }

  if (score >= -1) {
    return "Average";
  }

  if (score >= -3) {
    return "Fair-Poor";
  }

  if (score >= -5) {
    return "Weak";
  }

  if (score >= -7) {
    return "Very Weak";
  }

  if (score >= -9) {
    return "Poor";
  }

  return "Very Poor";
}


// ------------------------------------------------------
// COLOR
// ------------------------------------------------------
//
// Score:
// -10 = red
//   0 = yellow
// +10 = green
//

export function connectionColor(
  score
) {
  const normalized =
    (
      score +
      10
    ) /
    20;


  const hue =
    Math.round(
      normalized *
      125
    );


  return (
    `hsl(${hue}, 55%, 55%)`
  );
}


// ------------------------------------------------------
// GRID DATABASE
// ------------------------------------------------------
//
// 0.05 degrees is about 5 km vertically.
// This provides enough detail without producing
// too many Leaflet polygons.
//

const CELL_SIZE =
  0.04;


const SOUTH =
  30.35;

const NORTH =
  35.02;

const WEST =
  -85.61;

const EAST =
  -80.83;


export const connectivityCells =
  [];


for (
  let lat =
    SOUTH;

  lat <
    NORTH;

  lat +=
    CELL_SIZE
) {
  for (
    let lng =
      WEST;

    lng <
      EAST;

    lng +=
      CELL_SIZE
  ) {
    const centerLat =
      lat +
      CELL_SIZE / 2;

    const centerLng =
      lng +
      CELL_SIZE / 2;


    if (
      !pointInGeorgia(
        centerLat,
        centerLng
      )
    ) {
      continue;
    }


    const score =
      calculateConnectivity(
        centerLat,
        centerLng
      );


    connectivityCells.push({
      id:
        `${lat.toFixed(3)}-${lng.toFixed(3)}`,

      bounds: [
        [
          lat,
          lng
        ],

        [
          lat +
            CELL_SIZE,

          lng +
            CELL_SIZE
        ]
      ],

      center: [
        centerLat,
        centerLng
      ],

      score,

      status:
        connectionLabel(
          score
        )
    });
  }
}


// ------------------------------------------------------
// GET CONNECTIVITY FOR A POINT
// ------------------------------------------------------

export function connectivityAtPoint(
  point
) {
  if (
    !point ||
    point.length !== 2
  ) {
    return null;
  }


  const [
    lat,
    lng
  ] =
    point;


  for (
    const cell of
      connectivityCells
  ) {
    const [
      southwest,
      northeast
    ] =
      cell.bounds;


    if (
      lat >=
        southwest[0] &&

      lat <
        northeast[0] &&

      lng >=
        southwest[1] &&

      lng <
        northeast[1]
    ) {
      return cell;
    }
  }


  return null;
}


// ------------------------------------------------------
// ROUTE CONNECTIVITY
// ------------------------------------------------------

export function routeConnectivity(
  route
) {
  if (
    !route?.points?.length
  ) {
    return {
      score: 0,
      points: 0,
      level: "Average",
      average: 0,
      note:
        "No connectivity estimate available"
    };
  }


  const scores =
    [];


  // Sample up to roughly 35 places along the route.
  const step =
    Math.max(
      1,
      Math.floor(
        route.points.length /
        35
      )
    );


  for (
    let i = 0;

    i <
      route.points.length;

    i +=
      step
  ) {
    const cell =
      connectivityAtPoint(
        route.points[i]
      );


    if (cell) {
      scores.push(
        cell.score
      );
    }
  }


  if (
    !scores.length
  ) {
    return {
      score: -5,
      points: -5,
      level: "Weak",
      average: -5,
      note:
        "Outside demo Georgia connectivity area"
    };
  }


  const average =
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
    scores.length;


  const rounded =
    Math.max(
      -10,
      Math.min(
        10,
        Math.round(
          average
        )
      )
    );


  return {
    score:
      rounded,

    points:
      rounded,

    level:
      connectionLabel(
        rounded
      ),

    average,

    note:
      `Demo connectivity: ${connectionLabel(rounded)} (${rounded > 0 ? "+" : ""}${rounded})`
  };
}