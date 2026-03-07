# Planning Dictator 2.0

The purpose of this document is to provide context for planning the implementation of this project

## Project Overview

This project (dictator2) is a revamp of the dictator project (found at `~/dicator`). The purpose of the dictator2 project is to build a new frontend with improved UI/UX and to simplify the overall feature set of the app. The previous `dictator` project can be found at `~/dictator`.

## Strategy

- Backend:
    - Utilize the existing Flask backend from the dictator project as a starting point (it has been copied into this project already)
- Frontend:
    - Redo the frontend using Vite+React and shadcn for components
    - Use wireframes to solidify the UI/UX design
    - Shift to a desktop-only design scope

Significant changes from the dictator project:

- Desktop-only frontend design
- Frontend UI refines user experience into multiple views and dialogs
- Streamlined UX for creation of texts and scheduling of sessions
- UI design simplification using shadcn components and black and white color palette
- In-session commands are activated by typing into the input box rather than clicking buttons
- Removal of event logging feature in favour of new session history view
- Simplification of stories + chapters to just "texts" with levels.

## Tactics

- Use the wireframes in the `docs/wireframes` directory to plan and guide your work.
- Use the previous project (`~/dictator`) for extended context and reusable code.
- Consult the `docs` folder in the previous project for further context and references, including information about the original prototype.
