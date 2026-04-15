# Module Builder (Admin) - Current System Analysis

Last verified against code: April 15, 2026

## 1) Purpose

The Admin Module Builder is the authoring interface for building HelpDesk Academy modules.

Current authoring coverage:

- Module info (title, description, thumbnail, category at create time)
- Lesson management (sequence, summary, estimated minutes, overview text/image)
- Topic layer management under lessons
- Topic-scoped lesson content blocks (`text | image | video | simulation | file`)
- Assessment setup:
  - Pre Test
  - Post Test
  - Final Test
- Assessment question and answer creation (with correct-option and explanation)

Primary frontend entry:

- `frontend/src/pages/admin/AdminModulesPage.tsx`

Primary backend aggregation endpoint:

- `GET /api/modules/:id/builder` (admin-only)

---

## 2) Builder UI Structure (Frontend)

The builder currently uses six tabs:

1. `Module Info`
2. `Lessons & Content`
3. `Topics & Contents`
4. `Pre Test`
5. `Post Test`
6. `Final Test`

Source:

- `frontend/src/pages/admin/AdminModulesPage.tsx` (`Step` union)

Layout:

- Left rail: module list selector
- Right panel: active tab editor for selected module

---

## 3) Frontend State Model

Main state in `AdminModulesPage`:

- `modules`
- `builder`
- `selectedModuleId`
- `selectedLessonId`
- `selectedTopicId`
- `selectedPreTestLessonId`
- `selectedPostTestLessonId`
- `step`: `module | lessons | topics | preTest | postTest | finalTest`
- `busy`, `error`
- form states:
  - `newModule`
  - `newLesson`
  - `newTopic`
  - `newContent`
  - `newQuestion`
  - `newAnswer`

Data loading:

- `loadModules()` -> `getModules()`
- `loadBuilder(moduleId)` -> `getModuleBuilder(moduleId)`

Selection behavior on builder load:

- lessons are ordered by `sequence_no`
- lesson selection is preserved when possible
- topic selection is preserved when possible; otherwise first topic in selected lesson
- pre/post target selections are preserved when possible

---

## 4) Pre/Post/Final Classification Rules

Assessment classification in UI is still title-driven for lesson quizzes:

- Pre Test:
  - `quiz_type = 'lesson_quiz'`
  - title matches `/\bpre[-\s]?test\b/i`
- Post Test:
  - `quiz_type = 'lesson_quiz'`
  - not matched as pre-test
- Final Test:
  - `quiz_type = 'final_exam'`

Source:

- `frontend/src/pages/admin/AdminModulesPage.tsx`

Implication:

- Renaming a pre-test title without "pre test" semantics reclassifies it as post-test in UI.

---

## 5) Step-by-Step Behavior

### 5.1 Module Info

Create module form:

- Title (required)
- Category
- Thumbnail URL (optional)
- Thumbnail upload (optional, converted to data URL client-side)
- Description (required)

Create API:

- `POST /api/modules`

Notes:

- UI does not expose difficulty on create; backend defaults to `Beginner`.

Edit selected module panel:

- Editable in UI: title, description, thumbnail URL/file upload
- Save API:
  - `PUT /api/modules/:id`
- UI includes "Open User Preview" link to `/user/modules/:id`

Not currently editable in this UI:

- difficulty
- prerequisite module
- lock status
- active status

### 5.2 Lessons & Content

Current responsibilities:

- Add lesson
- Reorder lessons
- Delete lesson
- Edit lesson title/summary/estimated minutes/overview text/overview image

Lesson APIs:

- `POST /api/lessons`
- `PATCH /api/lessons/reorder`
- `DELETE /api/lessons/:id`
- `PUT /api/lessons/:id`

Important:

- Topic creation/content creation was removed from this step.
- UI explicitly directs users to `Topics & Contents` for topic/content authoring.

### 5.3 Topics & Contents

Current responsibilities:

- Select lesson context
- Add topic to selected lesson
- Reorder topics
- Delete topic
- Edit topic title/summary
- Add content block to selected topic
- Delete existing content block

Topic APIs:

- `POST /api/topics`
- `PATCH /api/topics/reorder`
- `PUT /api/topics/:id`
- `DELETE /api/topics/:id`

Content APIs:

- `POST /api/content` (requires `topicId`)
- `DELETE /api/content/:id`

Current UI limits:

- no content edit form
- no content reorder controls
- no file upload UX for content blocks (URL text input only)
- `simulationKey` exists in state/API but is not exposed by the add-content form

### 5.4 Pre Test

Placement model:

- Stored as `lesson_quiz` with `lesson_id`
- Interpreted in UI as "place before selected lesson"

Capabilities:

- select anchor lesson
- save placement via quiz update
- create pre-test if missing
- configure passing/time/attempt
- add questions and answers

APIs:

- `POST /api/quizzes`
- `PUT /api/quizzes/:id`
- `POST /api/quizzes/:id/questions`
- `POST /api/quizzes/questions/:questionId/answers`

### 5.5 Post Test

Placement model:

- lesson-scoped `lesson_quiz` records (`quiz.lesson_id`)

Capabilities:

- choose target lesson
- create post-test for selected lesson if missing
- configure passing/time/attempt
- add questions and answers

Same quiz/question/answer APIs as pre-test.

### 5.6 Final Test

Placement model:

- terminal assessment (end-of-sequence)
- stored as `quiz_type = 'final_exam'`, typically `lesson_id = null`

Capabilities:

- create if missing
- configure passing/time/attempt
- add questions and answers

### 5.7 Assessment Authoring Limits

In current admin UI:

- question/answer creation is supported
- question/answer edit/delete is not exposed
- quiz delete is not exposed
- quiz title edit is not exposed

Backend endpoints for those operations exist.

---

## 6) Backend API Surface Used by Builder

### 6.1 Modules

- `GET /api/modules`
- `POST /api/modules` (admin)
- `PUT /api/modules/:id` (admin)
- `DELETE /api/modules/:id` (admin)
- `GET /api/modules/:id/builder` (admin)

Controller:

- `backend/src/controllers/modulesController.js`

### 6.2 Lessons

- `POST /api/lessons` (admin)
- `PUT /api/lessons/:id` (admin)
- `DELETE /api/lessons/:id` (admin)
- `PATCH /api/lessons/reorder` (admin)

Controller:

- `backend/src/controllers/lessonsController.js`

### 6.3 Topics

- `POST /api/topics` (admin)
- `PUT /api/topics/:id` (admin)
- `DELETE /api/topics/:id` (admin)
- `PATCH /api/topics/reorder` (admin)

Controller:

- `backend/src/controllers/topicsController.js`

### 6.4 Content

- `POST /api/content` (admin)
- `DELETE /api/content/:id` (admin)

Controller:

- `backend/src/controllers/contentController.js`

### 6.5 Quizzes / Questions / Answers

- `POST /api/quizzes` (admin)
- `PUT /api/quizzes/:id` (admin)
- `POST /api/quizzes/:id/questions` (admin)
- `POST /api/quizzes/questions/:questionId/answers` (admin)

Controller:

- `backend/src/controllers/quizzesController.js`

---

## 7) Builder Aggregated Payload

`GET /api/modules/:id/builder` returns:

- `module`
- `lessons[]`
- `topics[]`
- `content[]`
- `quizzes[]`
- `questions[]`
- `answers[]`
- `certification`

Type reference:

- `frontend/src/types/lms.ts` -> `ModuleBuilderPayload`

This payload is the builder page source of truth.

---

## 8) Database Model Behind Builder

Core builder tables:

- `modules`
- `module_categories`
- `lessons`
- `topics`
- `lesson_content`
- `quizzes`
- `questions`
- `answers`
- `module_certification_settings`

Migration sources:

- `backend/src/db/migrations/003_lms_core_schema.sql`
- `backend/src/db/migrations/004_module_builder_enhancements.sql`
- `backend/src/db/migrations/005_topics_layer.sql`
- `backend/src/db/migrations/006_lesson_overview_fields.sql`

Relationship summary:

- `modules` 1-to-many `lessons`
- `lessons` 1-to-many `topics`
- `topics` 1-to-many `lesson_content`
- `modules` 1-to-many `quizzes`
- `lessons` optional 1-to-many `quizzes` via `quizzes.lesson_id`
- `quizzes` 1-to-many `questions`
- `questions` 1-to-many `answers`
- `modules` 1-to-1 `module_certification_settings`

---

## 9) Access Control

Global authentication:

- All `/api/*` routes (except `/api/auth` and `/api/health`) are behind `requireAuth` in `backend/src/app.js`.

Builder-sensitive operations:

- mutation routes use `requireRole('admin')`
- `GET /api/modules/:id/builder` is explicitly admin-only

Read endpoints like `GET /api/modules` are authenticated but not admin-only.

---

## 10) Runtime Learning Rules Connected to Builder Output

Learner-side enforcement comes from progression/results flow:

- lessons are sequential (`ensurePreviousLessonCompleted`)
- any quiz unlock requires all published lessons completed
- final exam unlock also requires all active lesson quizzes passed
- attempt limits enforced per quiz

Sources:

- `backend/src/services/progressionService.js`
- `backend/src/controllers/resultsController.js`

Completion behavior (current implementation):

- submitting a `final_exam` marks enrollment as `completed` (regardless of pass/fail state)

Note:

- `module_certification_settings` is still returned/stored, but not used in this completion path.
- `createCertificateIfEligible` exists in `progressionService` but is not called from quiz submission flow.

---

## 11) Current Gaps / Risks (Important)

1. Pre/Post detection still depends on title regex.
2. UI assumes one primary pre-test and one selected post-test context, but DB can hold multiple lesson quizzes per lesson/module.
3. Content management is partial in UI: create/delete only; no content edit/reorder UI.
4. Content form is URL-based; no direct file upload for content blocks.
5. `simulationKey` is not exposed in the topic content creation form.
6. Assessment authoring UI is create-only for questions/answers; no edit/delete controls.
7. Module edit UI omits backend-supported fields (difficulty, lock/active state, prerequisite).
8. Quiz management UI omits delete/title-edit controls.
9. Learner unlock logic ignores "pre/post placement semantics"; all lesson quizzes unlock only after all lessons.
10. Final exam submission currently completes enrollment even when failed.
11. Certification settings exist but are not integrated into current module completion flow.
12. Thumbnail/lesson image uploads are stored as data URLs, which can bloat payload/storage.

---

## 12) Suggested Next Refactor

1. Add explicit quiz stage metadata (`pre_test`, `post_test`, `final_test`) instead of title parsing.
2. Add DB constraints for intended uniqueness (one pre-test per module, one final exam per module, max one post-test per lesson if that is the rule).
3. Align runtime unlock to stage semantics (pre before lesson, post after lesson, final after required prerequisites).
4. Gate module completion on final exam pass (if that is required), not only submission.
5. Add full CRUD UI for topic content, quiz questions, and answers.
6. Expose module lifecycle fields (difficulty, is_active, is_locked, prerequisite) in admin builder UI.
7. Replace data URL image storage with proper file storage/upload pipeline.
8. Either wire `module_certification_settings` into active completion logic or remove/de-scope it cleanly.

---

## 13) Relevant Files

Frontend:

- `frontend/src/pages/admin/AdminModulesPage.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/types/lms.ts`

Backend controllers/services:

- `backend/src/controllers/modulesController.js`
- `backend/src/controllers/lessonsController.js`
- `backend/src/controllers/topicsController.js`
- `backend/src/controllers/contentController.js`
- `backend/src/controllers/quizzesController.js`
- `backend/src/controllers/resultsController.js`
- `backend/src/services/progressionService.js`

Backend routes/app:

- `backend/src/app.js`
- `backend/src/routes/modulesRoutes.js`
- `backend/src/routes/lessonsRoutes.js`
- `backend/src/routes/topicsRoutes.js`
- `backend/src/routes/contentRoutes.js`
- `backend/src/routes/quizzesRoutes.js`
- `backend/src/routes/resultsRoutes.js`

Database migrations:

- `backend/src/db/migrations/003_lms_core_schema.sql`
- `backend/src/db/migrations/004_module_builder_enhancements.sql`
- `backend/src/db/migrations/005_topics_layer.sql`
- `backend/src/db/migrations/006_lesson_overview_fields.sql`
