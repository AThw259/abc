export const trustPoints = {
  police: 5,
  fire_station: 5,
  hospital: 5,
  emergency_ward: 5,
  campus_police: 5,

  urgent_care: 4,
  clinic: 4,

  library: 3,
  government: 3,
  community_centre: 3,
  hotel: 3,

  pharmacy: 2,
  supermarket: 2,

  convenience: 1,
  restaurant: 1,
  cafe: 1,
  station: 1
};


export function placeType(
  tags = {}
) {

  if (
    tags.healthcare ===
    "urgent_care"
  ) {
    return "urgent_care";
  }


  if (
    tags.emergency ===
      "emergency_ward_entrance" ||
    tags.healthcare ===
      "emergency_ward"
  ) {
    return "emergency_ward";
  }


  if (
    tags.amenity ===
      "police" &&
    /campus|university/i.test(
      tags.name || ""
    )
  ) {
    return "campus_police";
  }


  if (
    tags.amenity &&
    Object.prototype
      .hasOwnProperty.call(
        trustPoints,
        tags.amenity
      )
  ) {
    return tags.amenity;
  }


  if (
    tags.healthcare ===
    "clinic"
  ) {
    return "clinic";
  }


  if (
    tags.office ===
    "government"
  ) {
    return "government";
  }


  if (
    tags.tourism ===
    "hotel"
  ) {
    return "hotel";
  }


  if (
    tags.shop ===
      "supermarket" ||
    tags.shop ===
      "convenience"
  ) {
    return tags.shop;
  }


  if (
    tags.railway ===
      "station" ||
    tags.public_transport ===
      "station"
  ) {
    return "station";
  }


  return null;
}


// Convert available opening-hours information into a simple state.
// NOTE: OpenStreetMap opening_hours can contain complex schedules. This
// lightweight hackathon version only treats 24/7 as definitely open and
// explicit off/closed as closed. Other schedules are returned as "unknown".
// The emergency Safe Place button therefore prefers confirmed-open places,
// then allows unknown-hours places instead of failing completely.
export function openingState(
  place
) {

  const hours =
    place.hours?.trim();


  if (!hours) {
    return "unknown";
  }


  if (
    hours ===
    "24/7"
  ) {
    return "open";
  }


  if (
    hours.toLowerCase() ===
      "off" ||
    hours.toLowerCase() ===
      "closed"
  ) {
    return "closed";
  }


  return "unknown";
}


export function havenStatus(
  place
) {

  const restricted = [
    "no",
    "private",
    "permit"
  ].includes(
    place.access
  );


  const state =
    openingState(
      place
    );


  const weight =
    trustPoints[
      place.type
    ] || 0;


  if (
    restricted
  ) {

    return {
      state,
      weight,
      points: 0,
      label:
        "Restricted access"
    };

  }


  if (
    state === "open"
  ) {

    return {
      state,
      weight,
      points:
        weight,
      label:
        "Open"
    };

  }


  if (
    state === "closed"
  ) {

    return {
      state,
      weight,
      points: 0,
      label:
        "Closed"
    };

  }


  return {
    state:
      "unknown",

    weight,

    points:
      Math.max(
        1,
        Math.round(
          weight *
          0.6
        )
      ),

    label:
      "Hours unknown · partial credit"
  };
}


export function havenCriteriaLabel(
  type
) {

  const points =
    trustPoints[
      type
    ] || 0;


  if (
    points === 5
  ) {
    return "Very High Trust";
  }


  if (
    points === 4
  ) {
    return "High Trust";
  }


  if (
    points === 3
  ) {
    return "Medium Trust";
  }


  if (
    points === 2
  ) {
    return "Low-Medium Trust";
  }


  if (
    points === 1
  ) {
    return "Low Trust";
  }


  return "Not scored";
}