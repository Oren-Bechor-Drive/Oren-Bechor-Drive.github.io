# Official source review - 2026-09-22

This is a bounded evidence review of official links and time-sensitive statements in the reading pages. It is not a legal certification and does not replace instructor review. The supplied PDF was read as source material and was not changed.

## Result

The speed defaults and the reviewed right-of-way safeguards remain supported by official transport material. The licensing lesson needed three corrections:

- The points-system introduction now covers both traffic offenses and administrative traffic violations. A convictions-only description became too narrow after the administrative-traffic framework.
- The legacy `NetuneiAvera` application link now points to the Ministry's current offense-code and points dataset. This preserves the original catalogue purpose.
- The old renewal-guide URL now points to the Ministry's current driving-license renewal service.

No numerical points allocation, future validity period, or implementation date was added. The official sources reviewed here do not establish all publication and commencement dates needed to do that safely.

## Evidence checked

### Speed

The [July 2025 official driving-instructor exam answer key](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-07-25-type2/he/final-exams_drivingteacher-07-25-type2-answers.pdf) gives the ordinary motor-vehicle defaults used in `course/signs-and-speed/`: 50 km/h on an urban road, 80 km/h on a nonurban road, 90 km/h on a nonurban road with a built divider, and 110 km/h on a motorway. It separately states 30 km/h for a shared street or traffic-calming zone, allows a lower vehicle-license limit, and treats buses and heavy commercial vehicles separately. The lesson already carries those qualifications.

The [official permitted-speed data specification](https://www.gov.il/BlobFolder/generalpage/geographic_information_and_roundtables/he/%D7%9E%D7%A4%D7%A8%D7%98_%D7%A9%D7%9B%D7%91%D7%95%D7%AA_%D7%9E%D7%94%D7%99%D7%A8%D7%95%D7%99%D7%AA_%D7%9E%D7%A8%D7%91%D7%99%D7%AA_%D7%9E%D7%95%D7%AA%D7%A8%D7%AA.pdf) also identifies signs 222 and 223 as the start and end of a 30 km/h traffic-calming zone. No speed copy was changed.

### Right-of-way and priority

The [official road-safety textbook](https://www.gov.il/BlobFolder/reports/driving_textbook/he/publications_2017_nohagim_aheret_nohagim_nachon.pdf) supports the reviewed safeguards:

- A driver must not enter a signalized junction unless it can be cleared, even with a green light.
- A flashing yellow signal requires slowing and, when needed, stopping for pedestrians and conflicting traffic.
- The stated order is police officer, traffic light, sign, then traffic rules. The source expressly excludes flashing yellow from the normal traffic-light priority rule.
- A U-turn is allowed only without danger or obstruction and is barred where visibility or signs prohibit it. A no-left-turn sign does not by itself prohibit a U-turn.

The course copy adds observation and pedestrian-protection language around these rules. I found no supported correction that justified editing the right-of-way or priority pages.

### Points-system timing

The [Ministry points-system guide](https://www.gov.il/he/pages/scoring_system_traffic_offens) remains the official topic page, and the [current points-printout service](https://www.gov.il/he/service/driver_penalty_point_check) says correction measures begin when enough valid points accumulate. Its public summary still describes the accumulation period as "usually two years".

The [Knesset announcement dated 2026-06-22](https://main.knesset.gov.il/news/pressreleases/pages/press22062026x.aspx) says the Economic Affairs Committee approved regulations applying the points system to administrative traffic violations. It also says changes to point allocations would start about 30 days after publication, while changes to point validity would start about one year after publication. This distinguishes committee approval from publication and commencement. I did not locate an official gazette copy in this bounded review, so the lesson does not state that a particular later validity period is already in force.

The [official traffic-fine service](https://www.gov.il/he/service/traffic-fine) shows that the administrative traffic tribunal is operating in September 2026. This supports avoiding a convictions-only explanation, but it does not prove the start date of every points-system amendment.

## Official-resource URL survey

The licensing page contains the only external official-resource links in the lesson HTML. A direct automated request on 2026-09-22 returned `403` for the gov.il and data.gov.il HTML page shells and `200` for the sign-chart PDF. Search indexing exposed current first-party content for the replacements and several retained pages. A `403` from this client does not show that a visitor's browser will receive the same response.

| Lesson label | Destination after review | Evidence and decision |
| --- | --- | --- |
| Offense-code and points table | `https://data.gov.il/he/datasets/ministry_of_transport/tavlat-simlei-averot/a2dd714b-e012-46e4-a996-6307f8b46fc5` | Current Ministry dataset with 1,608 offense records, including offense code, description, statute fields, and points. It was updated on 2026-09-01 and preserves the legacy application's catalogue purpose. |
| New-driver guide | `https://www.gov.il/he/pages/new_driver` | Retained. Direct request blocked; no better first-party replacement was established. |
| Official sign chart | `https://www.gov.il/BlobFolder/policy/tamrurim_7924_01_18/he/1694327856_%D7%9C%D7%95%D7%AA_%D7%9D_%D7%9E%D7%A9%D7%95%D7%9C%D7%91_0922.pdf` | Returned `200`; official search identified the September 2022 consolidated chart. |
| Information for a traffic defendant | `https://www.gov.il/he/pages/traffic_courts_information_for_the_traffic_defendant` | Retained. The Judicial Authority page was indexed with an update date of 2024-05-07. It covers court proceedings and does not replace the separate administrative-tribunal service. |
| Driving-license renewal | `https://www.gov.il/he/service/driving_license_renewal` | Current Ministry service indexed on the review date. Replaced the old guide URL. |
| Duplicate driving license | `https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss` | Retained; current Ministry service content was indexed on the review date. |
| Points system | `https://www.gov.il/he/pages/scoring_system_traffic_offens?chapterIndex=2` | Retained as the official topic page. Exact current allocations were not copied into the lesson. |
| Young new-driver accompaniment | `https://www.gov.il/he/pages/new_driver?chapterIndex=3` | Retained. It is an anchored view of the official new-driver guide. |
| New-driver offenses | `https://www.gov.il/he/pages/new_driver?chapterIndex=5` | Retained. It is an anchored view of the official new-driver guide. |

## Limits

- The gov.il and data.gov.il page shells blocked direct automated requests to HTML pages. Search results supplied current snippets, but they are not a substitute for opening every page in a normal browser.
- The Knesset committee announcement records approval and expected delays after publication. It does not supply the official publication date for each amended regulation.
- The sign chart is an official consolidated PDF dated September 2022. This review found no newer official chart, but absence from search results does not prove that none exists.
- The official road-safety textbook is older teaching material. It supports the stable principles cited above, not a claim that every sentence in it states current law.
- Review covered the course's official links and the highest-risk speed, points, licensing, and right-of-way claims. It did not certify every sentence in every lesson.

## Repeat review procedure

Run this review before publishing a material update to speed, licensing, new-driver, points, or right-of-way copy, and otherwise at least every six months:

1. Extract every external URL from `course/**/*.html` and identify the government body that owns each rule or service.
2. Check each destination in a normal browser. Record the date, final URL, page title, owning body, and visible update date. Treat automated `403` responses as inconclusive.
3. For legal changes, locate the official gazette or consolidated legislation. Record approval, publication, and commencement as separate dates. Do not infer commencement from a bill, committee discussion, press release, or future-date announcement.
4. Compare speed tables, points allocations, validity periods, age thresholds, and license conditions with the current official text. Preserve uncertainty when the official text cannot be reached.
5. Recheck the learner copy for absolute wording. Keep local signs, vehicle class, license restrictions, road conditions, and personal status where they affect the answer.
6. Update this dated note or add a new dated review. Run the learning-content tests and `git diff --check`. If an image declaration or asset changed, also run the media audit required by `README.md`.
7. Keep instructor review as a separate content-approval step. A source audit verifies evidence and wording limits; it does not approve the teaching adaptation.
