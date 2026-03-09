# TODO

## P0

- [ ] Implement up and down arrow listeners to enable historical input fill, similar to bash history.
- [ ] Remove command acknowledgements and point delta messages from the console output.
- [ ] font in console should be regular, not monospace.
- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Refine the ai prompt to draw more concise and targeted replies directed at the evaluation criteria used by the app.
- [ ] During a session, the dialog background should be pure black.

## P1

- [ ] The showdiff command isn't creating the correct output. While the mechanics and logic of the output is correct, it should not be displayed like that. Instead of displaying square brackets around the words which are incorrect, the words which are correct should be displayed in green and the words which are incorrect should be displayed in red.
- [ ] There should not be a replay button in the top right. Currently the tutor spinner is rendered here. Move that to another location because this is being removed.
- [ ] The help command should toggle the instructions panel.
- [ ] Make the tutor spinner more pronounced.
- [ ] Set styles for tutor output (possible in a box with a light colored background and in effect a separate stylesheet)
- [ ] The replay command should add a small component to the log (using html) saying "clip x replayed".

## P2

- [ ] The "start next session" button shouldn't start a session from the upcoming box. Only overdue and today. This is shown in the schedule view wireframe.
- [ ] There shouldn't be an X button in the top right corner.
- [ ] The abandon button hasn't been implemented correctly according to the wireframe.
- [ ] I want to know the spread of the score points per clip.
- [ ] The session over dialog headline should be session complete instead of session over.
- [ ] The date picker fields have two calendar icons on them and they overlap.
- [ ] On the schedule view, it says plan and launch your next sessions. It should say view your schedule and launch your next session.
- [ ] The calendar panel on the schedule view is too narrow, it needs to be wider so that there's no overflow of the session indicator pills within the day boxes.
- [ ] Score should not be % but multiplied by 100 when displayed, and shows 2 decimal places.
