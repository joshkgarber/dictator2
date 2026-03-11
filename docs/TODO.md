# TODO

## P0

### Ready

- [ ] The "showdiff" command should be shortened to "diff" to support further ease of use.
- [ ] The abandon button should have white text by default as shown in the wireframe (see `docs/wireframes/schedule_dialog.png`). Keep the black text on hover.
- [ ] The weighted score in the session over dialog needs to be displayed multiplied by 100 and rounded to the nearest whole number, the same as the history view.
- [ ] The "start next session" button should only consider texts scheduled for today, i.e. not those overdue and neither those upcoming. Currently it is also starting sessions for texts in the upcoming category. Not sure if it's also starting sessions for overdue. The requirement was already noted in the schedule view wireframe (`docs/wireframes/schedule_view.png`) — see "How it works" text connected to the "start next session button".
- [ ] In addition to its current function, the replay command should add the words "Clip replayed" in yellow to the console so that the user can see that they replayed the clip at that point.
- [ ] Tutor command output improvements
    - When the tutor command is invoked, A placeholder component with the words "Tutor called" and a spinner is added to the console.
    - When the response is received the placeholder is removed and the response is rendered.
    - The tutor output is rendered in a container with a purple border.
    - The tutor output is scrolled smoothly into view.
    - The tutor output text gets specific styles applied for its own internal consistency (rules for font-family (only one), headings, lists (including nested), horizontal rule, etc.)

### Needs Refinement

- [ ] Consider using structured outputs for tutor responses, and then format them for the output/console. This will provide more consistency.
- [ ] Change "Attempt Input" label to something else (maybe nothing).

## P1

- [ ] The "Due Today" label in the schedule view should be green not yellow.
- [ ] There should not be a replay button in the top right. Currently the tutor spinner is rendered here. Move that to another location because this is being removed.
- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Make the tutor spinner more pronounced.
- [ ] Option for dark mode and system default
- [ ] Help text needs a lot of love. including using the help command to toggle the instructions panel. and the up/down arrow history feature.

## P2

- [ ] Check the next launch target calculation. It should be older texts first.
- [ ] I want to know the spread of the score points per clip.
- [ ] On the schedule view, it says plan and launch your next sessions. It should say view your schedule and launch your next session.
- [ ] The calendar panel on the schedule view is too narrow, it needs to be wider so that there's no overflow of the session indicator pills within the day boxes.

## P3

- [ ] Convert to a desktop app
- [ ] Landing page for the project
- [ ] Open source deployment (via docker)
