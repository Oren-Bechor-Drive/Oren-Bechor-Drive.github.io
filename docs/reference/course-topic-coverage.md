# PDF coverage in the course library

Reviewed all 26 pages of [the supplied PDF](the-idea.pdf) against the [course library](../../course/index.html) on 2026-09-21. This is the only PDF found in the repository, excluding Git internals and installed dependencies. The supplied PDF bytes remain unchanged.

Page numbers below refer to actual PDF pages. The contents page uses slide numbers that do not match the final document order. "Reading page" means the source contains developed explanatory material and the course now adapts it. "Listed only" means the PDF names a subject without supplying enough teaching material to write a lesson faithfully.

The library has ten searchable outlines, and all ten link to newly created or expanded reading pages. Priority hierarchy is separate from right-of-way and turns. The owner approved one quiz per topic on 2026-09-25. Each of the ten topics now has a 20-question placeholder preview; right-of-way combines the three turn sections. This expands planned quiz coverage, not the supplied teaching evidence. Real questions and explanations still require Oren's delivery and approval.

| PDF page | Subjects reviewed | Library destination | Coverage status |
| --- | --- | --- | --- |
| 1 | Course purpose, practical learning of road rules | Introduction, `learning-foundations`, footer | Product context |
| 2 | Instructor introduction, theory and practical learning, real driving videos, supplement to driving lessons | Existing instructor credit, `learning-foundations`, footer | Product context. Personal biography and purchase prompt are not learning subjects. |
| 3 | Contents: definitions, turns and priority, turn hazards, U-turn restrictions, priority hierarchy, signs on traffic lights, road types, roundabouts, planning, lane recognition, official resources, signs, speed, overtaking, intersections, test failures, summary and conclusions | All ten outlines | Definitions and summary/conclusions are listed only; developed destinations are covered below. |
| 4 | Theory versus practice, driving culture, reasoning, learning from real cases, review between lessons and instructor questions | `course/learning-foundations/` | Reading page |
| 5 | Give way, stop, roundabout, two-way road, no U-turn, speed bumps, no entry, one-way road signs | `course/signs-and-speed/` | Reading page |
| 6 | Urban, traffic-calming, nonurban and motorway speeds; vehicle classes; sign overrides; reasonable speed; changing conditions; slow driving | `course/signs-and-speed/` | Reading page, with verified private/light-commercial values and corrected vehicle-class handling |
| 7 | Proposed case study of sign disobedience or speeding | `signs-and-speed` outline | Video prompt only; no identifiable case footage was supplied |
| 8 | Approaching intersections and speed bumps, approach speed, checking behind, deciding whether to stop or proceed | `course/roundabouts/#approach` | Reading section |
| 9 | Two-lane roundabout recognition, entry and exit lanes, route choice, checking both lanes, signaling | `course/roundabouts/#two-lane` | Reading section, with signaling qualified by local markings and instructor guidance |
| 10 | Single-lane roundabout approach, pedestrians, traffic from the left, motorcycles, speed, lane position, exit conflicts, signaling | `course/roundabouts/#single-lane` | Reading section |
| 11 | Proposed footage of single-lane and two-lane roundabout behavior | `roundabouts` outline | Video prompt only; footage was not supplied |
| 12 | U-turn definition, location restrictions, lane choice, radius and vehicle size, no-left-turn versus no-U-turn signs, signaling | `course/right-of-way/#u-turn` | Expanded reading section |
| 13 | U-turn control, hand/foot coordination, conflicts, visibility, opposing traffic, pedestrians, mirrors, ambiguous signaling | `course/right-of-way/#u-turn` | Expanded reading section |
| 14 | Left-turn priority, signs and junction layout, two turning lanes, planning the next turn, traffic lights and pedestrians | `course/right-of-way/#left-turn`, `course/trip-planning/` | Expanded reading section and reading page |
| 15 | Left-turn hazards: time in the junction, multiple conflicts, blind spots | `course/right-of-way/#left-turn` | Expanded reading section |
| 16 | Right-turn positioning and control, mirrors, motorcycles, pedestrians, signalized turns and clearing the junction | `course/right-of-way/#right-turn`, `course/driving-test/` | Expanded reading section and reading page |
| 17 | Priority when leaving parking, yards or fuel stations and turning off the main road; motorcycles; curb collision; opposing lane drift | `course/right-of-way/#right-turn` | Expanded reading section |
| 18 | Police, lights, signs and rules; unlit or flashing traffic lights; signs mounted on lights | `course/priority-hierarchy/` | Standalone reading topic |
| 19 | One-way road recognition, continuous divider versus traffic island, travel direction, parking on the left | `course/roads-and-lanes/#road-direction` | Reading section |
| 20 | Merge lanes, thick broken markings, arrows, turn-only lanes, checking adjacent traffic | `course/roads-and-lanes/#lane-markings`, `course/trip-planning/#merge` | Reading sections |
| 21 | Overtaking restrictions: solid line, limited visibility, stopped vehicle at crossing, no-overtaking sign | `course/overtaking/` | Reading page. Repeated no-U-turn video labels add no new content. |
| 22 | Crossing between one-way roads, blocked roads, obstacles, traffic ahead/behind, return right, merging, leaving turn-only lanes | `course/trip-planning/` | Reading page |
| 23 | Penalty-points examples: sidewalk, seat belts, towing, lights, obstruction, stop signs, roundabout priority, phone use | `course/licensing-and-points/#points` | Reading section. Categories retained; stale allocations omitted. |
| 24 | Points system, traffic-law resources, new drivers and accompaniment, sign chart, defendants, license services, new-driver offenses | `course/licensing-and-points/` | Reading page |
| 25 | Optional outline: turn priority and hazards, signalized turns, two turn lanes, uphill/downhill priority, priority hierarchy | `right-of-way`, `priority-hierarchy` outlines | Repeated developed subjects are covered. Uphill/downhill priority remains listed only because no explanation is supplied. |
| 26 | Test failures: turn position, stop line, pedestrians, emergency braking and mirror, clearance, parking, reversing, mirrors, junction clearance, wide turns, gear/stalling, lane changes, return right, blocked junction, red lights | `course/driving-test/` | Reading page |

## Source-faithful safety review

The learner copy stays close to the instructor's scenarios but does not repeat several PDF shortcuts as universal rules:

- PDF page 14 says there is no pedestrian priority when turning left or driving straight at a signalized intersection. The lesson instead requires checking the crossing and protecting anyone already crossing; the governing signal and signs still control the movement.
- PDF page 16 describes clearing a junction after the light changes while waiting for pedestrians. The lesson teaches entering only when the junction can be cleared and protecting pedestrians, without presenting a red light as permission to enter.
- PDF page 17 describes absolute priority when turning right from a main road. The lesson qualifies this by signals, signs, crossings and conflicting road users at the actual junction.
- PDF page 18 frames the hierarchy around a broken signal. The standalone lesson explains the broader order and treats a dark or yellow-flashing signal as a specific branch.
- PDF pages 9-10 use simplified roundabout signaling rules. The lesson focuses on lane choice, local markings, communicating intent and instructor guidance rather than one signal pattern for every roundabout.
- Exact steering-wheel fractions on page 16 are omitted because steering geometry and junction shape vary by vehicle.
- PDF page 26 lists emergency braking alongside an interior-mirror check, but the lesson does not present them as a rigid sequence. Continuous rear monitoring supports routine planning; when danger is imminent, the learner copy says to brake immediately without delaying for a mirror check. [UK Highway Code rule 118](https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158) supports that general safety principle and is not presented as Israeli law.

The [official road-safety textbook](https://www.gov.il/BlobFolder/reports/driving_textbook/he/publications_2017_nohagim_aheret_nohagim_nachon.pdf) was used to check U-turn restrictions and priority concepts. The [July 2025 official driving-instructor exam answer key](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-07-25-type2/he/final-exams_drivingteacher-07-25-type2-answers.pdf) confirms the 50/80/90/110 km/h defaults for an ordinary motor vehicle and the 30 km/h traffic-calming limit. It also separates buses and heavy commercial vehicles, so the PDF's combined heavy-vehicle/bus row is not reproduced. A sign or vehicle-license restriction can set a different limit.

The [Ministry of Transport points-system guide](https://www.gov.il/he/pages/scoring_system_traffic_offens) and the [Knesset's 2026 announcement](https://m.knesset.gov.il/apps/committees/2214/news/27484) were reviewed again on 2026-09-22. The Knesset says the committee approved applying the points system to administrative traffic violations and staged later changes after publication. The announcement is evidence of committee approval, not by itself proof of the regulations' publication date or the start date of each provision. The lesson therefore describes offenses and violations without publishing the PDF's numerical allocations or a fixed validity period as current law.

## Remaining source limits

- Definitions and summary/conclusions appear only in the contents and remain visibly unavailable rather than being invented.
- Page 24 includes an unexplained resource label, `חוק 2`; no title or destination is invented for it.
- Blank video slots and repeated labels add no identifiable teaching content.
- Page 24 embeds nine official government resource URLs. The licensing lesson replaces the legacy offense-data application with the Ministry's current offense-code and points dataset, updated on 2026-09-01, and replaces the old renewal guide with the current license-renewal service. On 2026-09-22, automated direct requests to the gov.il and data.gov.il HTML endpoints returned `403`, while the sign-chart PDF returned `200`. Official search results still exposed current content for the replacements and several retained pages. The `403` responses are a verification limitation, not proof that the pages are unavailable to visitors.
- Videos and real quiz questions have not been supplied to the repository. The owner reports the media and revised texts are finished and awaiting delivery. Every quiz remains explicitly marked as a placeholder; no answer keys or grades are invented.
- Instructor review remains required before these teaching adaptations are treated as final course material.
