import {
  havenStatus
} from "./havens.js?v=grid-4";


export const penalties = {
  harassment: 10,
  lighting: 3,
  isolated: 5,
  construction: 2,
  positive: -5
};


// Lighting still uses categories.
// Connectivity DOES NOT use this anymore.
export const levels = {
  lighting: {
    very_well_lit: 15,
    good: 10,
    some: 5,
    poor: -5,
    very_dark: -10
  }
};


export function reportWeight(
  created,
  now = Date.now()
) {
  const days =
    (
      now -
      created
    ) /
    86400000;


  if (
    !Number.isFinite(
      created
    ) ||
    days < 0 ||
    days > 30
  ) {
    return 0;
  }


  if (
    days < 1
  ) {
    return 1;
  }


  if (
    days < 7
  ) {
    return 0.75;
  }


  return 0.4;
}


export function category(
  score
) {
  if (
    score >= 85
  ) {
    return "Excellent";
  }


  if (
    score >= 70
  ) {
    return "Safer";
  }


  if (
    score >= 55
  ) {
    return "Moderate";
  }


  if (
    score >= 40
  ) {
    return "Caution";
  }


  return "Higher Caution";
}


export function distance(
  a,
  b
) {
  const rad =
    Math.PI / 180;


  const dLat =
    (
      b[0] -
      a[0]
    ) *
    rad;


  const dLng =
    (
      b[1] -
      a[1]
    ) *
    rad;


  const h =
    Math.sin(
      dLat / 2
    ) ** 2 +

    Math.cos(
      a[0] *
      rad
    ) *

    Math.cos(
      b[0] *
      rad
    ) *

    Math.sin(
      dLng / 2
    ) ** 2;


  return (
    6371000 *
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(
        Math.max(
          0,
          1 - h
        )
      )
    )
  );
}


export function distanceToRoute(
  point,
  line
) {
  if (
    !point ||
    !line ||
    line.length <
      2
  ) {
    return Infinity;
  }


  const scale =
    Math.cos(
      point[0] *
      Math.PI /
      180
    );


  const project =
    p => [
      (
        p[1] -
        point[1]
      ) *
        111195 *
        scale,

      (
        p[0] -
        point[0]
      ) *
        111195
    ];


  let best =
    Infinity;


  for (
    let i = 1;
    i <
      line.length;
    i++
  ) {
    const a =
      project(
        line[
          i - 1
        ]
      );


    const b =
      project(
        line[i]
      );


    const dx =
      b[0] -
      a[0];


    const dy =
      b[1] -
      a[1];


    const denominator =
      dx * dx +
      dy * dy ||
      1;


    const t =
      Math.max(
        0,
        Math.min(
          1,
          -(
            a[0] * dx +
            a[1] * dy
          ) /
          denominator
        )
      );


    const current =
      Math.hypot(
        a[0] +
          t * dx,

        a[1] +
          t * dy
      );


    best =
      Math.min(
        best,
        current
      );
  }


  return best;
}


export function scoreRoute(
  route,
  havens,
  reports,
  evidence = {},
  now = Date.now()
) {

  // ====================================================
  // SAFE HAVENS
  // ====================================================

  const nearbyPlaces =
    havens.filter(
      place =>
        distanceToRoute(
          place.position,
          route.points
        ) <=
        200
    );


  const rawSafePlacePoints =
    nearbyPlaces.reduce(
      (
        total,
        place
      ) =>
        total +
        havenStatus(
          place
        ).points,
      0
    );


  const safePlacePoints =
    Math.min(
      15,
      rawSafePlacePoints
    );


  // ====================================================
  // COMMUNITY REPORTS
  // ====================================================

  const relevant =
    reports.filter(
      report =>
        Object.prototype
          .hasOwnProperty.call(
            penalties,
            report.type
          ) &&

        reportWeight(
          report.created,
          now
        ) >
          0 &&

        distanceToRoute(
          report.position,
          route.points
        ) <=
          150
    );


  const negative =
    relevant.filter(
      report =>
        report.type !==
        "positive"
    );


  let community =
    0;


  if (
    negative.length
  ) {
    const total =
      negative.reduce(
        (
          sum,
          report
        ) =>
          sum +
          penalties[
            report.type
          ] *
          reportWeight(
            report.created,
            now
          ),
        0
      );


    community =
      -Math.min(
        15,
        total
      );
  }

  else {
    const positive =
      relevant.filter(
        report =>
          report.type ===
          "positive"
      );


    community =
      Math.min(
        5,
        positive.reduce(
          (
            total,
            report
          ) =>
            total +
            5 *
            reportWeight(
              report.created,
              now
            ),
          0
        )
      );
  }


  // ====================================================
  // SCORE BREAKDOWN
  // ====================================================

  const breakdown = {
    base: 50,

    safePlaces:
      safePlacePoints,

    community,

    lighting: 0,

    crime: 0,

    connectivity: 0
  };


  const unknown =
    [];


  // ====================================================
  // LIGHTING
  // ====================================================

  if (
    Object.prototype
      .hasOwnProperty.call(
        levels.lighting,
        evidence.lighting
      )
  ) {
    breakdown.lighting =
      levels.lighting[
        evidence.lighting
      ];
  }

  else {
    unknown.push(
      "lighting"
    );
  }


  // ====================================================
  // CRIME
  // ====================================================

  if (
    Number.isFinite(
      evidence.crimePoints
    )
  ) {
    // Crime can only subtract.
    breakdown.crime =
      Math.min(
        0,
        evidence.crimePoints
      );
  }

  else {
    unknown.push(
      "crime"
    );
  }


  // ====================================================
  // CONNECTIVITY
  // ====================================================
  //
  // Integer score from -10 through +10.
  //

  if (
    Number.isFinite(
      evidence.connectivityPoints
    )
  ) {
    breakdown.connectivity =
      Math.max(
        -10,
        Math.min(
          10,
          Math.round(
            evidence.connectivityPoints
          )
        )
      );
  }

  else {
    breakdown.connectivity =
      0;

    unknown.push(
      "connectivity"
    );
  }


  // ====================================================
  // FINAL SAFETY SCORE
  // ====================================================

  const total =
    Object.values(
      breakdown
    )
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );


  const safety =
    Math.round(
      Math.max(
        0,
        Math.min(
          100,
          total
        )
      )
    );


  return {
    ...route,

    safety,

    score:
      safety,

    category:
      category(
        safety
      ),

    breakdown,

    unknown,

    // This displays the actual -10 ... +10 value.
    connectivity:
      unknown.includes(
        "connectivity"
      )
        ? null
        : breakdown.connectivity,

    nearby:
      nearbyPlaces.length,

    concerns:
      negative.length
  };
}