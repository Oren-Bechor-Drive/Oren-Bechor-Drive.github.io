# Theory quiz content review - 2026-09-25

[theory-quiz-content.json](theory-quiz-content.json) is the content selected for the public practice quizzes. It contains 140 unique questions: all 118 original candidates and 22 additional questions found in the same official Ministry bank. Each question belongs to one learning topic. Counts follow the subject matter, with no duplication to reach a fixed quiz length.

| Topic | Questions |
| --- | ---: |
| יסודות הנהיגה והלמידה | 9 |
| זיהוי כבישים ונתיבים | 15 |
| תמרורים ומהירויות | 14 |
| מדרג הציות | 15 |
| זכויות קדימה ופניות | 16 |
| מעגלי תנועה וצמתים | 12 |
| עקיפה ואיסורי עקיפה | 17 |
| תכנון נסיעה | 11 |
| טעויות נפוצות בטסט | 14 |
| נהג חדש, רישוי ושיטת הניקוד | 17 |

## Provenance and schema

The source is the [Ministry's official CKAN datastore](https://data.gov.il/api/3/action/datastore_search?resource_id=bf7cb748-f220-474b-a4d5-2d59f93db28d&limit=10000). The response contains 1,802 records. Source timestamps, the response hash, the declared CC BY licence and retrieval limitations are retained in the JSON and [the initial research note](theory-question-bank-2026-09-25.md). The 2026 review date is not a claim that the archived official bank was updated in 2026.

The JSON contains source metadata, a source-reference map, topic IDs and per-question topic assignments. Each question has one `topicId`, four options, a zero-based `correctOptionIndex`, its official source ID, source image URLs where applicable and a short Hebrew explanation. Explanations are course-authored. The original bank supplies answer keys but no explanations.

Eleven questions are adapted. Each stores its prior normalized source stem, options and key in `originalSource`, and the change, evidence and Hebrew label in `adaptation`. Published pages must identify those questions as adaptations rather than verbatim official questions. All other stems, options and keys match the downloaded source after documented whitespace and ASCII-punctuation normalization.

Ten questions use eight original images. Their unchanged bytes, dimensions, hashes and visually checked Hebrew alternatives are recorded in [the media manifest](theory-media.json) and [media review](theory-media-2026-09-25.md). Question image fields copy that manifest. The images are part of the question and must accompany it.

## Additional search and actual coverage

The full Hebrew bank was filtered for licence B, represented by Cyrillic `В` in the source. Search covered the question stem and all options, with manual checks to avoid treating a term in a wrong answer as the question's topic.

New IDs are `0003`, `0011`, `0017`, `0052`, `0070`, `0127`, `0220`, `0246`, `0251`, `0266`, `0267`, `0333`, `0335`, `0336`, `0550`, `0551`, `0667`, `0669`, `0750`, `0752`, `0988` and `1787`.

- Licensing gains basic entitlement and vehicle familiarity, points-system purpose and corrective measures, medical fitness, training and corrected administrative questions.
- Roundabouts gain the meaning of sign 303 and the action required by it. Existing image scenarios cover entry priority including a cyclist. The topic also owns junction approach and pedestrian observation. No bank item was relabelled as a two-lane exit scenario when it did not depict one.
- Priority hierarchy gains flashing yellow, steady yellow, directional green and the end of the green phase.
- Foundations gains the distinction between lighting time and nighttime. Roads gains keeping right. Trip planning gains preparation for a sustained descent.

The practical-test topic tests ordinary safe-driving skills. It makes no claim that a particular answer is an official practical-test failure criterion. The public practice quizzes are not a simulation of the official 30-question theory examination.

## Concrete checks and changes

| IDs | Check and outcome | Evidence |
| --- | --- | --- |
| `0004` | Added the requirement that the companion's same-class licence be valid. Explanation preserves the instructor age exception. | [Ministry accompaniment service](https://www.gov.il/he/service/new_driver_accompaniment_period_statement). |
| `0266`, `0267` | Replaced the archived three-month and all-new-drivers claims with the ordinary six-month programme for young new drivers under 24. The wording excludes the age-24 crossover from the blanket duration assertion. | Accompaniment service above and [February 2026 instructor law answers](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-02-26-type2/he/final-exams_drivingteacher-02-26-type2-answers.pdf), answer 5. |
| `0268`, `0296`, `0054`, `0055` | Kept the under-21 new-driver passenger distinction, sober-companion requirement and lower rear-window sign. Explained that new-driver status can extend. | Same accompaniment and instructor sources; sign placement also appears in the [official textbook](https://www.gov.il/BlobFolder/reports/driving_textbook/he/publications_2017_nohagim_aheret_nohagim_nachon.pdf). |
| `0333` | Replaced age 17 with 16 years and 9 months for B entitlement. Did not infer the theory or lesson-start age from this figure. | [Ministry licence-class table](https://www.gov.il/BlobFolder/guide/driving_licence_categories/he/rank_license.pdf), B row; [licensing service](https://www.gov.il/he/service/apply_for_new_driver_drivers_license). |
| `0251` | Replaced mandatory carrying of the vehicle licence with the regulation 9 distinction between valid licences and carrying documents. Retained identification, insurance and required annexes. | [Current licence-renewal service](https://www.gov.il/he/service/driving_license_renewal). |
| `0052` | Replaced convictions-only points wording with traffic offences and administrative traffic violations that attract points under law. Added no exact allocation, expiry date or commencement date. | [Points guide](https://www.gov.il/he/pages/scoring_system_traffic_offens), [June 2026 Knesset announcement](https://main.knesset.gov.il/news/pressreleases/pages/press22062026x.aspx) and the distinction between approval and commencement recorded in [the earlier review](official-source-review-2026-09-22.md). |
| `0220`, `0127`, `0336` | Retained the authority's corrective-measure and training powers. Explained that corrective measures do not erase a court penalty and are not all conditional on a prior court proceeding. | [Knesset research on driver courses and points](https://fs.knesset.gov.il/globaldocs/MMM/7af0ba14-9c73-ec11-8144-00155d0401c3/2_7af0ba14-9c73-ec11-8144-00155d0401c3_11_19542.pdf) and the Ministry points guide. No historical points thresholds were copied. |
| `0335` | Kept licensing-authority responsibility for licence decisions. The medical institute supplies medical recommendations. | [Ministry of Health medical-fitness service](https://www.gov.il/he/service/medical-fitness-tests-for-driving). |
| `0027` | Expanded the correct answer from drivers alone to entitled road users and explicitly included not forcing a stop or wait. | [February 2025 instructor methodology answers](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-02-25-type3/he/final-exams_drivingteacher-02-25-type3-answers.pdf), answer 6. |
| `0744`, `1752` | Specified the narrow, steep road for descending-driver priority. Added slowing and necessary, safe shoulder movement to the general narrow-road answer. | [December 2024 instructor law answers](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-12-24-type2/he/final-exams_drivingteacher-12-24-type2-answers.pdf), answer 1, and the official textbook. |
| `0733` | Limited the mirror-before-slowing sequence to planned slowing. Explanation states that emergency braking must not wait for a mirror check. | Safety qualification consistent with the observation guidance in the official textbook and the [lesson source review](israeli-lesson-sources-2026-09-25.md). |
| `0134` | Qualified the stopped-vehicle overtaking answer to a vehicle stopped to comply with the law. Avoids treating every stationary vehicle near a junction as the same legal scenario. | February 2026 instructor law answers, overtaking section, explicitly reproduces the stopped-to-comply qualification. The archived answer omitted it. |
| `0119`, `1783` | Explained that arrows requiring a direction other than left or U-turn prohibit a U-turn from that lane. A no-left-turn sign alone does not remove all U-turn conditions. | Official textbook U-turn discussion and the prior lesson-source review. |
| `0069`, `0246`, `0667`, `0669`, `1787` | Kept traffic-light precedence limited to priority signs, with flashing yellow excluded. Added precise steady-yellow stopping rule and directional-green interpretation. | [Official sign chart](https://www.gov.il/BlobFolder/policy/tamrurim_7924_01_18/he/1694327856_%D7%9C%D7%95%D7%AA_%D7%9D_%D7%9E%D7%A9%D7%95%D7%9C%D7%91_0922.pdf). The weaker archived `1750` item was not added. |
| `0387`, `0430`, `0431`, `0550`, `0551`, `0706`, `0721` | Distinguished the advance-warning triangle from the blue priority sign and matched the scenario wording to original images. | Same sign chart and [visual media review](theory-media-2026-09-25.md). |
| `1486`, `0802`, `0803`, `0444`, `0258`, `1484` | Kept urban private-car default at 50 km/h, required reasonable speed below the legal ceiling when necessary, and disallowed excess speed during overtaking. | [July 2025 instructor law answers](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/drivingteacher-07-25-type2/he/final-exams_drivingteacher-07-25-type2-answers.pdf) and the official textbook. |
| `0820`, `0257`, `0192` | Added context: two seconds is guidance for ordinary conditions; abandoning an overtake requires a safe return; blocked-lane priority is subject to traffic control. | Official question keys plus the road-safety principles in the textbook. These explanations do not create additional legal permissions. |

## Evidence limits

This review screened every selected stem and keyed answer for obvious outdated or ambiguous claims, with focused independent checks for licensing, points, traffic control and manoeuvre exceptions. It is not a claim to have independently proved every distractor against a consolidated statute as of September 2026.

Initial gov.il service and instructor-PDF requests returned HTTP 403. A later request with browser headers downloaded the February 2026 law-answer PDF and the official road-safety textbook successfully. The February 2026 PDF was directly read for accompaniment, overtaking and the stopped-to-comply qualification on printed page 12, item 6. Indexed first-party text supplied other cited content where direct reading remained blocked. The official CKAN question JSON and offense catalogue were directly retrieved. The latter contains 1,608 entries, including legacy descriptions: its recent resource date does not establish that every row is a current standalone statement. It was used as corroboration, not as authority for obsolete accompaniment periods or exact penalties.

An unrelated regional military traffic amendment and legislative proposals surfaced in search and were not used as national enacted law. The Road Safety Authority's older general new-driver page also contains inconsistent status wording; only its sign-placement passage was corroborative. The Ministry accompaniment service and February 2026 instructor answers supplied the precise status distinctions.

## Verification

The content check compares all 140 IDs against the downloaded official records, requires four options and one answer index, verifies licence B and unique topic ownership, preserves all 118 original candidates and confirms that every changed stem or answer has a matching `originalSource` and adaptation record. Image references and alternatives are checked against the media manifest. Authored Hebrew text uses ASCII punctuation. A separate content reviewer checked all 140 keyed answers and eight source images. That review tightened the Israeli identification-document wording in `0251`, added licence-restriction context to `0070`, and obtained direct PDF support for `0134`. Runtime quiz behavior and browser checks belong to the implementation verification.
