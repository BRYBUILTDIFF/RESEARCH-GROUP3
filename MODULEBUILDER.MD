# Module Builder (Admin) - Current System Analysis

## 1) Purpose

The Admin Module Builder is the authoring interface used to create and manage a full training module in HelpDesk Academy.

It currently supports:

- Module info (title, description, thumbnail)
- Lessons and lesson sequence
- Lesson content blocks (text, image, video, simulation, file)
- Assessment setup using:
  - Pre Test
  - Post Test
  - Final Test
- Quiz questions and answers with correct-option marking and explanation/feedback

Primary frontend entry:

- `frontend/src/pages/admin/AdminModulesPage.tsx`

Primary backend aggregation endpoint:

- `GET /api/modules/:id/builder`

---

## 2) Builder UI Structure (Frontend)

The builder is organized into step tabs:

1. `Module Info`
2. `Lessons & Content`
3. `Pre Test`
4. `Post Test`
5. `Final Test`

This flow is implemented by the local `Step` union in:

- `frontend/src/pages/admin/AdminModulesPage.tsx`

The left area contains module selection (all modules). The right area renders the active step editor for the selected module.

---

## 3) Frontend State Model

Main page state in `AdminModulesPage`:

- `modules`: module list (for left-side selector)
- `builder`: full builder payload for active module
- `selectedModuleId`: active module
- `selectedLessonId`: active lesson in Lessons step
- `selectedPreTestLessonId`: lesson anchor for pre-test placement
- `selectedPostTestLessonId`: lesson anchor for post-test placement
- `step`: current tab (`module | lessons | preTest | postTest | finalTest`)
- `busy`, `error`: request state
- form states:
  - `newModule`
  - `newLesson`
  - `newContent`
  - `newQuestion`
  - `newAnswer`

Data load functions:

- `loadModules()` -> `getModules()`
- `loadBuilder(moduleId)` -> `getModuleBuilder(moduleId)`

When builder loads:

- first lesson is auto-selected
- pre-test lesson anchor defaults to existing pre-test placement (if found), otherwise first lesson
- post-test target defaults to first lesson

---

## 4) Pre/Post/Final Test Classification Rules

Current classification is title-driven for lesson quizzes:

- **Pre Test**: `quiz_type = 'lesson_quiz'` AND title matches `/\bpre[-\s]?test\b/i`
- **Post Test**: `quiz_type = 'lesson_quiz'` AND not recognized as pre-test
- **Final Test**: `quiz_type = 'final_exam'`

Source:

- `frontend/src/pages/admin/AdminModulesPage.tsx`

Important implication:

- If a pre-test is renamed without including "pre test" text, it will be treated as post-test by the UI logic.

---

## 5) Step-by-Step Behavior

## 5.1 Module Info

Create module form (top section):

- Title (required)
- Thumbnail URL (optional)
- Category
- Difficulty
- Description (required)

API used:

- `POST /api/modules`

Edit selected module (Module tab):

- Editable currently: title, description, thumbnail URL
- Save action uses:
  - `PUT /api/modules/:id`

Note:

- Category and difficulty are set at creation, but current edit panel does not expose them for update even though backend supports them.

## 5.2 Lessons & Content

Lesson management:

- Add lesson (`POST /api/lessons`)
- Reorder lesson via Up/Down (`PATCH /api/lessons/reorder`)
- Delete lesson (`DELETE /api/lessons/:id`)
- Edit lesson title/summary/estimated minutes (`PUT /api/lessons/:id`)

Lesson content management:

- Add content block (`POST /api/content`)
  - content type: `text | image | video | simulation | file`
  - title/body/url/simulation key
- Delete content block (`DELETE /api/content/:id`)

Current UI does not provide inline edit/reorder for existing content blocks, although backend supports content update.

## 5.3 Pre Test

Placement model:

- Pre-test is attached to a lesson via `quiz.lesson_id`, interpreted as "place before this lesson".
- Admin selects target lesson, then saves placement (`PUT /api/quizzes/:id` with `lessonId`).

Visualization:

- sequence card list of all lessons
- pre-test card injected before anchored lesson when pre-test exists

Creation:

- If no pre-test exists in current step, create button appears.
- Create action:
  - `POST /api/quizzes`
  - `quizType = 'lesson_quiz'`
  - title defaults to `<Module Title> Pre Test`

## 5.4 Post Test

Placement model:

- Post-test is lesson-scoped using `quiz.lesson_id`.
- Admin selects target lesson and creates/edits the test for that lesson.

Visualization:

- each lesson shows whether a post-test is present

Creation:

- `POST /api/quizzes`
- `quizType = 'lesson_quiz'`
- title defaults to `<Module Title> Post Test`

## 5.5 Final Test

Placement model:

- Always represented as terminal assessment after lessons.
- Stored with `quiz_type = 'final_exam'` and `lesson_id = null`.

Creation:

- `POST /api/quizzes`
- title defaults to `<Module Title> Final Test`

---

## 6) Assessment Authoring (Questions and Answers)

For pre/post/final selected test:

- Configure:
  - passing score
  - time limit (minutes)
  - attempt limit
- Save settings:
  - `PUT /api/quizzes/:id`

Question management:

- Add question prompt:
  - `POST /api/quizzes/:id/questions`

Answer management per question:

- Add answer text
- Mark correct answer
- Optional explanation/feedback
- API:
  - `POST /api/quizzes/questions/:questionId/answers`

Current UI supports add/display, but not edit/delete for questions/answers (APIs exist in backend for update/delete).

---

## 7) Backend API Surface Used by Builder

## 7.1 Module

- `GET /api/modules`
- `POST /api/modules` (admin)
- `PUT /api/modules/:id` (admin)
- `DELETE /api/modules/:id` (admin)
- `GET /api/modules/:id/builder` (admin)

Controllers:

- `backend/src/controllers/modulesController.js`

## 7.2 Lessons

- `GET /api/lessons?moduleId=...`
- `POST /api/lessons` (admin)
- `PUT /api/lessons/:id` (admin)
- `DELETE /api/lessons/:id` (admin)
- `PATCH /api/lessons/reorder` (admin)

Controllers:

- `backend/src/controllers/lessonsController.js`

## 7.3 Content

- `GET /api/content?lessonId=...`
- `POST /api/content` (admin)
- `PUT /api/content/:id` (admin)
- `DELETE /api/content/:id` (admin)

Controllers:

- `backend/src/controllers/contentController.js`

## 7.4 Quizzes / Tests

- `GET /api/quizzes?moduleId=...`
- `POST /api/quizzes` (admin)
- `PUT /api/quizzes/:id` (admin)
- `DELETE /api/quizzes/:id` (admin)
- `GET /api/quizzes/:id/questions` (admin)
- `POST /api/quizzes/:id/questions` (admin)
- `PUT /api/quizzes/questions/:questionId` (admin)
- `DELETE /api/quizzes/questions/:questionId` (admin)
- `GET /api/quizzes/questions/:questionId/answers` (admin)
- `POST /api/quizzes/questions/:questionId/answers` (admin)
- `PUT /api/quizzes/answers/:answerId` (admin)
- `DELETE /api/quizzes/answers/:answerId` (admin)

Controllers:

- `backend/src/controllers/quizzesController.js`

---

## 8) Builder Aggregated Payload

`GET /api/modules/:id/builder` returns:

- `module`
- `lessons[]`
- `content[]`
- `quizzes[]`
- `questions[]`
- `answers[]`
- `certification`

Type reference:

- `frontend/src/types/lms.ts` -> `ModuleBuilderPayload`

This endpoint is the main source of truth for the admin builder page.

---

## 9) Database Model Behind Builder

Core tables used directly by builder:

- `modules`
- `module_categories`
- `lessons`
- `lesson_content`
- `quizzes`
- `questions`
- `answers`
- `module_certification_settings` (currently returned in builder payload)

Schema sources:

- `backend/src/db/migrations/003_lms_core_schema.sql`
- `backend/src/db/migrations/004_module_builder_enhancements.sql`

Relationship summary:

- `modules` 1-to-many `lessons`
- `lessons` 1-to-many `lesson_content`
- `modules` 1-to-many `quizzes`
- `lessons` optional 1-to-many `quizzes` via `quizzes.lesson_id`
- `quizzes` 1-to-many `questions`
- `questions` 1-to-many `answers`
- `modules` 1-to-1 `module_certification_settings`

---

## 10) Access Control

Builder mutation routes are protected by `requireRole('admin')`.

Examples:

- module create/update/delete
- lesson create/update/delete/reorder
- content create/update/delete
- quiz/test create/update/delete
- question/answer create/update/delete

Read routes (`GET`) are generally authenticated; some are not role-restricted.

Route files:

- `backend/src/routes/modulesRoutes.js`
- `backend/src/routes/lessonsRoutes.js`
- `backend/src/routes/contentRoutes.js`
- `backend/src/routes/quizzesRoutes.js`

---

## 11) Runtime Learning Rules Connected to Builder Output

Learner-side enforcement is driven by progression services, not by builder UI tabs:

- Lessons are sequentially enforced (`ensurePreviousLessonCompleted`)
- Quizzes unlock only after **all** published lessons are completed
- Final exam unlocks after all active lesson quizzes are passed
- Attempt limits are enforced

Source:

- `backend/src/services/progressionService.js`

Completion behavior:

- Submitting final exam marks enrollment status as `completed` in `resultsController`

Source:

- `backend/src/controllers/resultsController.js`

Note:

- This is aligned with your recent requirement "no certification page, module completed after final test."

---

## 12) Current Gaps / Risks (Important)

1. Pre/Post detection depends on quiz title regex.
2. Builder UI supports one visible pre-test and one mapped post-test per lesson; DB can technically hold more, which may create hidden/ambiguous records.
3. Certification settings still exist in schema and builder payload, but user completion now depends on final exam submission logic.
4. Content add form does not expose file upload handling (URL-based only).
5. `createContent` default `sortOrder = 1`; repeated inserts may create identical sort orders unless client sets ordering.
6. No admin UI for editing/deleting quiz questions/answers after creation (backend endpoints exist).
7. No hard backend rule that "pre-test must be before lessons" or "post-test must be below lesson content"; current behavior is convention plus UI.
8. Learner unlock logic currently ignores pre/post placement and requires all lessons complete before lesson quizzes (including pre-tests) become available.

---

## 13) Suggested Next Refactor (If You Want It Robust)

1. Replace title-based pre/post detection with explicit `quiz_stage` enum in DB (`pre_test`, `post_test`, `final_test`).
2. Add uniqueness constraints:
   - one pre-test per module
   - one final-test per module
   - at most one post-test per lesson
3. Align progression unlock logic with intended stage semantics:
   - pre-test before first lesson or configured anchor
   - post-test after lesson completion
   - final-test after all lessons and required post-tests
4. Expose full CRUD UI for questions/answers and content reorder/edit.
5. Remove or repurpose `module_certification_settings` if certification remains out of scope.

---

## 14) Relevant Files

Frontend:

- `frontend/src/pages/admin/AdminModulesPage.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/types/lms.ts`

Backend:

- `backend/src/controllers/modulesController.js`
- `backend/src/controllers/lessonsController.js`
- `backend/src/controllers/contentController.js`
- `backend/src/controllers/quizzesController.js`
- `backend/src/controllers/resultsController.js`
- `backend/src/services/progressionService.js`
- `backend/src/routes/modulesRoutes.js`
- `backend/src/routes/lessonsRoutes.js`
- `backend/src/routes/contentRoutes.js`
- `backend/src/routes/quizzesRoutes.js`

Database:

- `backend/src/db/migrations/003_lms_core_schema.sql`
- `backend/src/db/migrations/004_module_builder_enhancements.sql`
