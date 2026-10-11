# SafeRoute Safety Score Criteria

Each route starts at **50 points**.

## Formula

```text
Final Safety Score =
50
+ Streetlight Points
+ Safe Place Points
+ Crime Points
+ Community Report Points
+ Internet / Cox Connectivity Points
```

Final score is capped between **0 and 100**.

## 1. Streetlights

| Condition | Points |
|---|---:|
| Very well lit | +15 |
| Good lighting | +10 |
| Some lighting | +5 |
| Poor lighting | -5 |
| Very dark | -10 |

## 2. Safe Places

| Trust level | Points per open place | Place types |
|---|---:|---|
| Very High Trust | +5 | Police, fire station, hospital / ER, campus police |
| High Trust | +4 | Urgent care, clinic |
| Medium Trust | +3 | Library, government building, community center, hotel |
| Low-Medium Trust | +2 | Pharmacy, grocery store |
| Low Trust | +1 | Convenience store, restaurant, cafe, transit station |

Add the full weight of each eligible place within 150 m of the route. **No Safe Haven cap.** Only the final overall score is capped at 100.

A place contributes only when its mapped opening hours indicate it is open now and it has no mapped private/restricted access. Closed places, missing hours, unsupported schedules, and unknown timezones contribute 0. Emergency facilities are not automatically assumed to be open 24/7. Listed hours do not guarantee admission or working services. Scores refresh every minute, using current time rather than estimated arrival time.

The MVP supports 24/7, daily or weekday/range schedules, split time intervals, overnight hours, and explicit closed days. Holiday, seasonal, appointment-only, or other complex expressions remain unknown. Atlanta-area schedules use America/New_York; elsewhere an explicit timezone tag is required for timed schedules.

## 3. Crime / Incident Risk

| Crime type | Suggested penalty |
|---|---:|
| Drug offense / possession | -1 |
| Vandalism / property damage | -1 |
| Shoplifting / retail theft | -2 |
| Theft / larceny | -3 |
| Vehicle theft | -4 |
| Burglary | -4 |
| Robbery | -6 |
| Simple assault | -5 |
| Aggravated assault | -8 |
| Weapons offense | -7 |
| Shooting | -10 |
| Sexual offense | -10 |
| Kidnapping | -10 |
| Homicide | -12 |

Sum penalties for distinct incidents within 150 m of the route, reported in the past 30 days. For multiple offenses in one incident, count only the highest penalty. No separate crime cap is applied; the final safety score remains capped at 0-100. Future-dated and older reports are ignored. No records or unrecognized offenses do not earn a safety bonus; unknown crime data is labeled. Shooting requires an explicit shooting description, not just firearm involvement.

## 4. Community Reports

| Report Type / Condition | Points |
|---|---:|
| Positive feedback / no negative reports | +5 |
| No reports | 0 |
| Poor lighting | -3 |
| Isolated area | -5 |
| Blocked sidewalk / construction | -2 |
| Harassment | -10 |
| Multiple negative reports | Up to -15 |

Suggested time weighting:

| Report Age | Weight |
|---|---:|
| Less than 24 hours | 100% |
| 1–7 days | 75% |
| 7–30 days | 40% |
| More than 30 days | Ignore |

## 5. Internet / Cox Connectivity

| Condition | Points |
|---|---:|
| Strong connectivity | +10 |
| Good connectivity | +5 |
| Average connectivity | 0 |
| Weak connectivity | -5 |
| Very weak / dead zone | -10 |

For the hackathon MVP, Cox connectivity data should be labeled as demo data unless a verified Cox dataset or API is available.

## Final Score Categories

| Score | Category |
|---|---|
| 85–100 | Excellent |
| 70–84 | Safer |
| 55–69 | Moderate |
| 40–54 | Caution |
| 0–39 | Higher Caution |

## Example

```text
Route A

Starting Score        50
Streetlights         +10
Safe Places          +10
Crime                 -5
Community Reports    -10
Cox Connectivity      +5
                     ----
Final Score           60
```

```text
Route B

Starting Score        50
Streetlights         +15
Safe Places          +15
Crime                 -3
Community Reports      0
Cox Connectivity     +10
                     ----
Final Score           87
```

This score is a recommendation heuristic, not a guarantee that a route is completely safe.
