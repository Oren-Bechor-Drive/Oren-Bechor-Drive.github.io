# Official theory question candidates - 2026-09-25

Publication follow-up: the owner subsequently authorized implementing variable-length theory quizzes. See [the published selection and review](theory-quiz-review-2026-09-25.md). The initial research below is retained as provenance.

The Ministry of Transport's open-data bank contains real theory questions, their four answer options and the official answer key. [The candidate JSON](theory-question-candidates-2026-09-25.json) selects 113 distinct text-only questions for licence B, mapped to the ten learning topics, plus five image-dependent roundabout questions for later media review. These are research candidates, not published practice quizzes or approved paid answer keys.

The bank is old enough to contain incorrect administrative answers. Its official origin does not establish that every answer matches current law or the current examination. The selected questions avoid the stale items found during this review. This is a bounded content screen, not a complete legal verification of 113 questions.

## Source and retrieval

The [Ministry's official theory collection](https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data) identifies the official question bank. The downloadable data is the [Hebrew open-data dataset](https://data.gov.il/he/datasets/ministry_of_transport/tqhe). The following official CKAN endpoints worked on the review date:

- [Dataset metadata](https://data.gov.il/api/3/action/package_show?id=tqhe).
- [All question records as JSON](https://data.gov.il/api/3/action/datastore_search?resource_id=bf7cb748-f220-474b-a4d5-2d59f93db28d&limit=10000).

Dataset ID: `618dd157-8df3-43e7-bf9a-00974b4919e9`. Resource ID: `bf7cb748-f220-474b-a4d5-2d59f93db28d`. The returned `result.total` and downloaded record count were both 1,802. Of these, 1,273 carry licence B and 716 B questions have no image declaration. Counts describe this response, not the present examination pool.

The dataset metadata was last modified `2023-03-21T18:32:47.687636`; the resource last-modified field is `2021-12-05T15:55:03.264408`. Many records retain 2011 publication dates. Neither a recent download nor the metadata modification date makes the questions a 2026 edition.

SHA-256 of the exact downloaded datastore JSON response:

```text
2e94c25d619b84ce56d796fc7a341f1e74c2ff196825184341aeb550f2d82572
```

The direct XML resource returned HTTP 200 after redirecting to Google sign-in HTML, rather than XML. The direct XLSX resource returned HTTP 403. The current gov.il collection also returned HTTP 403 to a direct request. The CKAN JSON response, not those unsuccessful downloads, is the source of the candidates. Raw downloads remain under `/tmp`; no full raw bank or source images were added to the repository.

## Format and fidelity

Each datastore row has a `title2` containing the question number and stem, a `description4` containing HTML answer options, a category, a publication timestamp and a datastore row ID. The correct answer is the option containing a span whose ID begins with `correctAnswer`. Licence classes appear in the HTML footer. The bank uses Cyrillic `В`, not Latin `B`, for the private-car class.

The candidate JSON preserves question IDs, option order, category and the keyed answer. `correctOptionIndex` is zero-based. It keeps the source classes and provides normalized `B` in `licenseClasses`. HTML was removed, whitespace collapsed and typographic punctuation converted to ASCII. No answer or distractor was rewritten to repair an obsolete question. The text contains the source's wording, including occasional spelling or spacing defects.

The source has no answer explanations. Any future explanations must be authored separately, checked against the lesson sources and identified as course explanations. Do not imply that course explanations, topic mapping or selection were supplied or endorsed by the Ministry.

## Reuse terms

The [dataset metadata](https://data.gov.il/api/3/action/package_show?id=tqhe) explicitly declares `isopen: true`, `license_id: cc-by` and `license_title: Creative Commons Attribution`. Its licence URL points to the [Open Definition CC BY entry](https://opendefinition.org/licenses/cc-by/), which permits reuse and redistribution with appropriate credit. The metadata does not identify a specific CC BY version. Its link currently presents several versions, so do not silently relabel the source as a specific version.

Retain Ministry attribution, the dataset link, its declared licence link and the modification notice when publishing a selection. Attribute the question source without implying Ministry endorsement of the course. The five image URLs are source references only; downloading, inspecting and integrating their original images is separate work. No rights to unrelated third-party explanations or replacement artwork are inferred.

Suggested Hebrew attribution for a future published selection:

> מקור השאלות והתשובות: משרד התחבורה והבטיחות בדרכים, מאגר השאלות והתשובות הרשמי למבחן נהיגה עיוני ממוחשב באתר data.gov.il. רישיון המאגר: Creative Commons Attribution. הוסרו תגיות עיצוב ואוחדו רווחים וסימני פיסוק. בחירת השאלות, שיוכן לנושאים והסברי הקורס אינם מטעם משרד התחבורה.

## Coverage

These counts describe proposed placements, with overlap only where a question teaches a shared skill. There are 130 placements across 113 distinct text-only questions. No topic was padded to 20 with unrelated questions. The course's existing 20-question practice-quiz contract has not changed.

| Learning topic | Text-only candidates | Remaining coverage |
| --- | ---: | --- |
| יסודות הנהיגה והלמידה | 15 | Instructor-specific learning guidance and further definitions. |
| זיהוי כבישים ונתיבים | 13 | Image-based markings and specific merge layouts. |
| תמרורים ומהירויות | 14 | Visual sign recognition and additional road-class speed cases. |
| מדרג הציות | 11 | More distinct control scenarios without repetitive variations. |
| זכויות קדימה ופניות | 18 | Illustrated turning positions and multi-vehicle priority scenarios. |
| מעגלי תנועה וצמתים | 9 | These cover junction approach, pedestrians and lane changes only. Roundabout signs, circulating priority and two-lane exits remain uncovered by the text-only set. |
| עקיפה ואיסורי עקיפה | 17 | Image scenarios and exception-sensitive statutory cases. |
| תכנון נסיעה | 12 | Route-specific planning and merge layouts. |
| טעויות נפוצות בטסט | 15 | No official theory question is evidence of a practical-test failure rule. |
| נהג חדש, רישוי ושיטת הניקוד | 6 | Current points rules, application procedure, age and accompaniment duration. |

For roundabouts, separate image-dependent candidates are `0387`, `0430`, `0431`, `0706` and `0721`. Their source stems, options, keys and original gov.il image URLs are in `imageDependentCandidates`. These must not become text-only quiz items: the diagram or sign is part of the question. The images were not downloaded or visually reviewed here.

## Legal review boundaries and rejected items

The candidate set favors definitions, observation, safe manoeuvres and stable road rules. The [lesson source review](israeli-lesson-sources-2026-09-25.md) supplies independent government teaching evidence for definitions, narrow-road priority, new-driver distinctions and lane changes. The [earlier source review](official-source-review-2026-09-22.md) records limitations around changing points rules. These reviews do not validate every distractor and exception in the archived bank.

The [Ministry's current accompaniment service](https://www.gov.il/he/service/new_driver_accompaniment_period_statement) contradicts archived `0266` and `0267`, which describe three months of accompaniment and apply it to all new drivers. The current ordinary programme lasts six months and distinguishes young new drivers under 24. The [Ministry's licence-renewal page](https://www.gov.il/he/service/driving_license_renewal) contradicts `0251` by explaining that regulation 9 permits driving without carrying the vehicle or driving licence, while other required documents remain necessary. The [Knesset's enacted-reform announcement](https://main.knesset.gov.il/News/PressReleases/Pages/PR_1724.aspx) records the change to age 16 years and 9 months, contradicting `0333`'s age 17 key. Current application guidance is on the [Ministry's licensing service](https://www.gov.il/he/service/apply_for_new_driver_drivers_license).

Other excluded items and reasons are recorded in `excludedQuestions` in the JSON. Examples include overbroad traffic-light precedence in `0059`, incomplete steady-yellow instructions in `1750`, old points wording in `0052`, and exception-sensitive tunnel and railway overtaking questions. Exclusion means unsuitable for this bounded selection; it does not claim that every excluded item is wholly false.

Some selected questions still need explanatory context before publication:

- `0004` addresses the ordinary companion age and experience routes. A valid licence and the driving-instructor exception need explanation.
- `0021` describes a junction's boundary, not every exception to the junction definition.
- `0119` and `1783` do not remove the safety, visibility, signalling and marking requirements for a U-turn.
- `0257` describes abandoning an unsafe overtake. Returning must be safe; the word "quickly" is not permission for an abrupt dangerous lane change.
- `0744` applies where opposing vehicles cannot pass together on the narrow slope. `1752` does not permit an unsafe departure onto the shoulder.
- `0820` is the recommended two-second technique, not a universal statutory gap or a claim that two seconds is enough in every condition.
- The practical-test topic maps ordinary driving skills. It does not assert that any particular mistake automatically fails a practical test.

Before using a candidate as a scored practice question, resolve those contextual notes, supply an accurate explanation and review current rule-sensitive details. Preserve the official ID and distinguish any adapted wording from the original-source question.
