---
spec_id: SPEC-01PLANNING-003
title: "User Stories"
spec_version: "2.0.0"
status: draft
tier: STANDARD
stage: "01-planning"
category: user-stories
owner: "@pm"
created: 2026-04-26
last_updated: 2026-05-05
gate: G1
references:
  - docs/01-planning/requirements.md
  - docs/01-planning/scope.md
  - docs/04-build/sprints/sprint-1-plan.md
  - docs/04-build/sprints/sprint-6-plan.md
---

# User Stories — NQH Creative Studio

## Overview

These user stories define the **G1-level acceptance criteria** for the NQH Creative Studio fork.
Each story maps to one or more Functional Requirements (FR-*) in
`docs/01-planning/requirements.md` and is bounded by `docs/01-planning/scope.md`.

**Target personas:**
- **Employee** — marketing, design, or content team member at NQH/MTS; uses the studio daily to
  create images for internal and external campaigns.
- **IT Admin (dvhiep)** — provisions and maintains the Mac Mini M4 Pro 48 GB inference server;
  deploys and configures the application on the LAN.
- **Marketing Team Member** — creates multi-asset ad campaigns and product imagery.
- **Content Creator** — produces video content for social media and advertising.

---

## Sprint 1 User Stories

### US-1 — Employee Generates Image Locally

**References:** FR-C01 (Image Studio UI), FR-L03 (local inference client), NFR-1, NFR-2, NFR-9
**Scope reference:** `scope.md §3.3 Local Image Generation`
**Priority:** Must Have

#### User Story

As an **Employee**, I want to generate images using a local AI model from the studio UI, so that
I can create campaign assets without incurring per-image cloud costs.

#### Acceptance Criteria (BDD)

```gherkin
GIVEN I am logged into NQH Creative Studio on the LAN
WHEN I enter a text prompt and click "Generate"
THEN the system routes the request to the local Flux Schnell engine
AND returns a generated image within 60 seconds
AND no external API call is made
```

---

### US-2 — IT Admin Deploys Local Inference Server

**References:** FR-L01 (model registry), FR-L02 (engine selection), NFR-3
**Scope reference:** `scope.md §3.1 Infrastructure`
**Priority:** Must Have

#### User Story

As an **IT Admin**, I want to deploy and configure the local inference server on the Mac Mini,
so that the creative team can generate images without cloud dependency.

#### Acceptance Criteria (BDD)

```gherkin
GIVEN I have SSH access to the Mac Mini M4 Pro
WHEN I run the deployment script with default configuration
THEN the inference server starts and registers available models
AND the health endpoint returns HTTP 200
AND the studio UI shows "Local" as the active engine
```

---

## Sprint 6 User Stories

### US-HOT-SWAP — IT Admin Switches Pipelines Without Restart

**References:** FR-L02 (engine selection), NFR-1 (availability), NFR-2 (performance)
**Scope reference:** MOP Phase A — Hot-swap infrastructure
**Priority:** Must Have
**Sprint:** 6

#### User Story

As an **IT Admin**, I want to switch between Image and Marketing pipelines without restarting the
server, so that the Mac Mini can serve multiple studios with limited RAM.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Switch from Image pipeline to Marketing pipeline
  GIVEN the server is running with the Image pipeline loaded
  AND the Image pipeline is idle (no in-flight requests)
  WHEN I send a POST request to /api/pipeline/switch with body {"target": "marketing"}
  THEN the server unloads the Image pipeline from memory
  AND loads the Marketing pipeline
  AND returns HTTP 200 with {"active": "marketing", "memory_freed_mb": <number>}
  AND total switch time is under 30 seconds

Scenario: Reject switch while pipeline is busy
  GIVEN the server is running with the Image pipeline loaded
  AND there is an in-flight generation request
  WHEN I send a POST request to /api/pipeline/switch with body {"target": "marketing"}
  THEN the server returns HTTP 409 with {"error": "pipeline_busy", "in_flight": <count>}
  AND the Image pipeline remains active

Scenario: Memory stays within bounds after switch
  GIVEN the server has switched pipelines 5 times in succession
  WHEN I query the /api/health endpoint
  THEN reported memory usage is below 40 GB
  AND there are no leaked model tensors from previous pipelines
```

---

### US-RMBG — Marketing Team Member Removes Backgrounds Locally

**References:** FR-C02 (image processing), NFR-2 (performance), NFR-9 (data governance)
**Scope reference:** MOP Phase A — RMBG-2.0 integration
**Priority:** Must Have
**Sprint:** 6

#### User Story

As a **Marketing Team Member**, I want to remove backgrounds from product images locally, so that
I can create transparent assets without cloud API cost.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Remove background from a product photo
  GIVEN I am in the Image Studio with a product photo uploaded
  WHEN I click "Remove Background"
  THEN the system processes the image using the local RMBG-2.0 model
  AND returns a PNG with transparent background within 10 seconds
  AND no external API call is made

Scenario: Batch background removal
  GIVEN I have selected 5 product images in the Image Studio
  WHEN I click "Remove Background (Batch)"
  THEN all 5 images are processed sequentially
  AND each result is a PNG with transparent background
  AND total processing time is under 50 seconds

Scenario: Handle non-product images gracefully
  GIVEN I upload an abstract or landscape image with no clear foreground subject
  WHEN I click "Remove Background"
  THEN the system returns a result (best-effort segmentation)
  AND displays a confidence score below 70%
  AND shows a warning: "Low confidence — review result manually"
```

---

### US-MARKETING-TAB — Marketing Team Member Accesses Marketing Studio

**References:** FR-C03 (Marketing Studio UI), NFR-1 (availability)
**Scope reference:** MOP Phase A — Marketing tab
**Priority:** Must Have
**Sprint:** 6

#### User Story

As a **Marketing Team Member**, I want to access Marketing Studio directly, so that I can create
multi-asset ad campaigns from a single interface.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Navigate to Marketing Studio tab
  GIVEN I am logged into NQH Creative Studio
  WHEN I click the "Marketing" tab in the main navigation
  THEN the Marketing Studio interface loads
  AND displays campaign creation tools (headline, body copy, CTA, image slots)
  AND the active pipeline switches to Marketing (hot-swap) if not already loaded

Scenario: Create a multi-asset campaign
  GIVEN I am in the Marketing Studio
  WHEN I fill in campaign brief (product name, target audience, tone)
  AND click "Generate Campaign"
  THEN the system generates at least 3 ad variants (different aspect ratios)
  AND each variant includes headline, body text, and a generated image
  AND all images are generated locally (zero cloud cost)

Scenario: Export campaign assets
  GIVEN I have a generated campaign with 3 variants
  WHEN I click "Export All"
  THEN the system downloads a ZIP containing all variants
  AND each variant is in PNG format with correct dimensions
  AND a metadata.json file lists all copy and settings used
```

---

### US-VIDEO-TAB — Content Creator Accesses Video Studio

**References:** FR-C04 (Video Studio UI), NFR-1 (availability)
**Scope reference:** MOP Phase A — Video cloud tab
**Priority:** Should Have
**Sprint:** 6

#### User Story

As a **Content Creator**, I want to access Video Studio for cloud-based video generation, so that
I can create video ads without managing GPU infrastructure.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Navigate to Video Studio tab
  GIVEN I am logged into NQH Creative Studio
  WHEN I click the "Video" tab in the main navigation
  THEN the Video Studio interface loads
  AND displays video generation options (prompt, duration, aspect ratio)
  AND shows a cost estimate before generation (based on fal.ai pricing)

Scenario: Generate a video ad
  GIVEN I am in the Video Studio
  WHEN I enter a video prompt and select 5-second duration
  AND click "Generate Video"
  THEN the system sends the request to the cloud video API (fal.ai)
  AND displays a progress indicator with estimated time remaining
  AND returns an MP4 video file upon completion
  AND the generation cost is logged for budget tracking

Scenario: Video generation cost transparency
  GIVEN I am about to generate a video
  WHEN the cost estimate is displayed
  THEN it shows the per-second rate and total estimated cost
  AND requires explicit confirmation ("Generate — estimated cost $X.XX")
  AND the running monthly total is visible in the UI

Scenario: Handle cloud API failure gracefully
  GIVEN I have submitted a video generation request
  WHEN the cloud API returns an error or times out
  THEN the system displays a clear error message
  AND no cost is charged for the failed request
  AND offers a "Retry" button
```

---

## Sprint 8 User Stories

### US-LIPSYNC — Content Creator Creates Lip-Synced Video Locally

**References:** FR-S8-01 (LivePortrait), FR-S8-02 (face detection), NFR-2, NFR-9
**Scope reference:** MOP Phase A — Lip Sync Studio
**Priority:** Must Have
**Sprint:** 8

#### User Story

As a **Content Creator**, I want to generate lip-synced videos from a portrait image
and audio clip locally, so that I can create talking-head content without cloud API cost
and without sending face data to external services.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Generate lip-synced video from image + audio
  GIVEN I am in the Lip Sync Studio with a portrait image uploaded
  AND I have uploaded a 5-second audio clip
  WHEN I click "Generate"
  THEN the system detects the face in the portrait using RetinaFace (MIT)
  AND generates a lip-synced video using LivePortrait (MIT)
  AND returns an MP4 video within 30 seconds
  AND no external API call is made

Scenario: Face detection fails gracefully
  GIVEN I upload an image with no clear face (e.g., landscape photo)
  WHEN I click "Generate"
  THEN the system returns an error: "No face detected in image"
  AND suggests uploading a clear frontal portrait

Scenario: Local/cloud mode switching
  GIVEN I am in Lip Sync Studio on the MacBook (local mode)
  AND LivePortrait is not available locally (spike PROD-ONLY)
  WHEN the studio loads
  THEN it shows a banner: "Lip sync runs on production server only"
  AND falls back to cloud models for generation
```

---

### US-LIPSYNC-TAB — Content Creator Accesses Lip Sync Studio

**References:** FR-S8-03 (tab activation), NFR-1
**Scope reference:** MOP Phase A — Lip Sync tab
**Priority:** Must Have
**Sprint:** 8

#### User Story

As a **Content Creator**, I want to access the Lip Sync Studio tab directly, so that I
can use both local and cloud lip sync models from one interface.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Navigate to Lip Sync Studio
  GIVEN I am logged into NQH Creative Studio
  WHEN I click the "Lip Sync" tab in the main navigation
  THEN the Lip Sync Studio interface loads
  AND displays both Image mode and Video mode options
  AND shows available models (local LivePortrait + cloud models)

Scenario: Dual mode — Image and Video input
  GIVEN I am in Lip Sync Studio
  WHEN I toggle between Image mode and Video mode
  THEN the upload area changes to accept the correct file type
  AND the model list filters to show compatible models
```

---

### US-TTS-LIPSYNC — Content Creator Creates Video from Text (Optional)

**References:** FR-S8-04 (VibeVoice TTS), NFR-2
**Scope reference:** MOP Phase A — Voice integration
**Priority:** Could Have
**Sprint:** 8

#### User Story

As a **Content Creator**, I want to type text and have it automatically converted to
speech and lip-synced to a portrait, so that I can create talking-head videos without
recording audio.

#### Acceptance Criteria (BDD)

```gherkin
Scenario: Text-to-speech-to-lip-sync pipeline
  GIVEN I am in Lip Sync Studio with a portrait uploaded
  WHEN I type text in the prompt field and click "Generate with Voice"
  THEN the system converts text to speech using VibeVoice (MIT)
  AND feeds the generated audio into LivePortrait
  AND returns a lip-synced video with the generated voice
```

---

## Traceability Matrix

| Story ID | Sprint | Requirement | Priority | Persona | Pipeline |
|----------|--------|-------------|----------|---------|----------|
| US-1 | 1 | FR-C01, FR-L03 | Must Have | Employee | Image (local) |
| US-2 | 1 | FR-L01, FR-L02 | Must Have | IT Admin | Infrastructure |
| US-HOT-SWAP | 6 | FR-L02, NFR-1, NFR-2 | Must Have | IT Admin | Infrastructure |
| US-RMBG | 6 | FR-C02, NFR-2, NFR-9 | Must Have | Marketing Team Member | Image (local) |
| US-MARKETING-TAB | 6 | FR-C03, NFR-1 | Must Have | Marketing Team Member | Marketing (local) |
| US-VIDEO-TAB | 6 | FR-C04, NFR-1 | Should Have | Content Creator | Video (cloud) |
| US-LIPSYNC | 8 | FR-S8-01, FR-S8-02, NFR-2, NFR-9 | Must Have | Content Creator | Lip Sync (local) |
| US-LIPSYNC-TAB | 8 | FR-S8-03, NFR-1 | Must Have | Content Creator | Lip Sync (local+cloud) |
| US-TTS-LIPSYNC | 8 | FR-S8-04, NFR-2 | Could Have | Content Creator | Voice + Lip Sync |
