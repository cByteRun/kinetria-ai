# IdeaRoute prototype verification

final result: passed

## Scope and source of truth

The requested deliverable is a new, unique IdeaRoute UX/UI prototype. The business workflow and the DOCX requirements take precedence over visual imitation. This is not a pixel clone of the SalesOps sales dashboard.

- Requirements: `docs/TZ/ТЗ_на_разработку_системы_обратной_связи_и_предложений_сотрудников.docx`, especially §§2.2–2.7 and 3.2.
- Product direction: IdeaRoute Business Vision supplied in the request.
- Data: all 20 synthetic source cases in `docs/TZ/Датасет.docx`; original descriptions, types, categories and statuses preserved. Titles, demo dates, directions, events, links and the unassigned A-020 case are explicit prototype adaptations.
- Composition: `tmp/sales-ops-dashboard/SalesOps Dashboard.htm` and its referenced live page, `https://app.example.invalid/`.

## Visual evidence

- Source desktop capture: `qa/reference-salesops.jpg`.
- Implementation desktop viewport: `qa/overview-viewport.jpg`.
- Same comparison surface: `qa/comparison.html`; captured as `qa/comparison.jpg` and visually inspected with both designs present.
- Full overview: `qa/overview-desktop.jpg`.
- Case result, including decision, completed work and author acknowledgement: `qa/result-desktop.jpg`.
- Submission form: `qa/new-case-desktop.jpg` and `qa/new-case-mobile.jpg`.
- Analytics: `qa/analytics-desktop.jpg`.
- Mobile overview: `qa/overview-mobile.jpg`.

Desktop comparison CSS viewport: 1280 × 720. Both viewport screenshots are 1265 × 712 pixels as returned by the browser tool; identical raster size, no manual resampling. Full-page captures have their native page heights. Mobile CSS viewport: 390 × 844; the rendered document is 375 CSS pixels wide with a reserved scrollbar and no horizontal document overflow. Temporary viewport settings are reset before handoff.

Source state: SalesOps Overview. Prototype state: IdeaRoute manager overview, Operational Processes, original demo data restored. The deliberately different themes and product content are expected changes. This comparison assesses composition, hierarchy and readable working density rather than literal color matching.

Full-page form and result captures were also inspected separately at readable scale. These are the focused checks for form labels, multiline content, responsible person, decision, completed actions and history; the scaled side-by-side overview alone was not treated as sufficient.

## Required design surfaces

1. Typography: locally bundled Manrope with Cyrillic; distinct heading, metric, label and body levels. Body copy and secondary text were enlarged or darkened after initial inspection. No remote font dependency in the standalone HTML.
2. Layout: persistent sidebar and contextual top bar, four operational indicators, route overview, priority queue and recent results. The requested reference supplies the frame; sales charts are replaced by workflow information. Grid children have explicit shrinkability, while wide registers and stage lanes scroll within their own containers.
3. Colors: neutral light work surface and violet IdeaRoute accent. Green indicates published outcomes, amber indicates attention/clarification, red indicates overdue cases. Labels supplement color. This light theme intentionally differs from the dark SalesOps source.
4. Assets: Lucide icon library and actual local font assets. No raster placeholders or generated decorative imagery were needed for this enterprise workflow. The brand marker uses the library's route icon.
5. Content: product copy focuses on employee cases, accountability, next actions, decisions, outcomes and feedback. Published results are distinguished from an explicit author acknowledgement. No sales revenue, invented economic savings, employee rankings or external-customer MVP workflow.

## Issues found and resolved

- P1: hidden form fields named `id` shadowed `HTMLFormElement.id`, bypassing the delegated submit handler. Renamed them to `recordId`. Repeated question, decision, category, routing and manual assignment flows successfully after the fix.
- P2: mobile dashboard grids allowed table minimum widths to widen the document. Added shrinkable grid items and contained horizontal overflow at the shell. Rechecked overview and submission at 390 × 844: document width 375, no document-level horizontal overflow, local table/lane scrolling retained.
- P2: some secondary text and case titles were too small/light. Increased body and form label sizes and darkened secondary copy. Rechecked desktop result and mobile submission screenshots.
- P2: wording implied the author had read a result as soon as it was published. Changed it to “Ответ доступен автору” / “Ответ опубликован”. Read acknowledgement remains a separate explicit action.
- P2: completed-case properties displayed the completion date under the deadline label. Restored the original deadline in the properties panel; completion remains separately visible in the result.
- P2: role and direction reverted on reload. Added session-scoped context persistence and verified that employee result access survives reload.
- P2: recent results used reverse source order rather than completion time. Sort them by actual `closedAt`.
- P2: closed mobile navigation remained focusable offscreen. Hide it with CSS visibility until explicitly opened; Escape and menu selection close the drawer.

The final screenshots were captured after the fixes. No unresolved P0/P1/P2 issue was identified in the verified prototype scope.

## Browser scenarios verified

- Employee selects a category and fills the example; preview resolves responsible person and deadline.
- Registration creates A-021, records history, shows it to the author and creates a notification for the correct management direction.
- Manager starts review and requests clarification.
- Employee sees the question and replies; status returns to review, preserving comments and events.
- Empty decision is rejected by form validation.
- Decision “Принято — передать в работу” stores the plan and keeps the case open.
- “Реализовано” requires completed-action text, publishes the result and notifies the author.
- Employee opens the result notification and explicitly acknowledges the outcome.
- Reload retains the data and demo role.
- Employee cannot open A-005; a manager in IT and Data cannot open the operations case A-021.
- Administrator assigns original unassigned A-020 from reserve, removing it from the queue.
- Administrator saves a routing rule; a settings audit entry is visible.
- Administrator creates a category without a routing rule.
- Employee attaches a synthetic text file and registers A-022 in that category; attachment is present in the case and the record appears in administrator reserve.
- Search with no matches shows an empty state.
- Department = Sales plus overdue filter yields the expected A-009 case; board view preserves the same selection.
- Analytics renders computed indicators and type/outcome/category distributions.
- Manager publishes a reasoned refusal for A-001; its employee author sees the explanation.
- Mobile overview, navigation drawer and submission form inspected at 390 × 844.
- Standalone `IdeaRoute.html` opens, renders the same data and actions, and has no external script, stylesheet or font dependency.
- Demo reset restores the original 20 cases and rules after test activity.
- Browser console inspected for warnings/errors after the core flow and standalone run: none returned.
- JavaScript syntax checked with Node for both application and seed files.

## Honest limits and remaining test gaps

This is a front-end interactive prototype, not a production service. Role scoping illustrates the intended UX; it is not a security boundary. All data live in browser storage. Notifications are in-app demonstrations. Attachments remain local. No integrations, external messaging, background scheduler or production authentication are implemented.

Download/export controls are implemented but CSV content and attachment download were not manually opened during browser verification. No broad cross-browser or formal assistive-technology audit was performed. Production access control, delivery guarantees and actual SLA operation require backend work, described in the prototype help screen and README.

## Implementation checklist

- [x] New artifact isolated to `tmp/maket`.
- [x] Three roles from the DOCX, explicit access scopes and distinct actions.
- [x] Closed-loop flow and both successful and declined outcomes.
- [x] Reserve queue and routing configuration.
- [x] Responsive browser review and interaction checks.
- [x] Standalone HTML with bundled Tailwind v4, fonts and icons.
- [x] Coverage map, demonstration instructions and limitations.
- [x] Original demo data restored for handoff.

final result: passed
