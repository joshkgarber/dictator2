# TODO

## P0

### Ready

- [ ] Change the heading "Session Over" to "Session Complete!" in session over dialog.
- [ ] Remove the "exact commands only" text under the attempt input box.
- [ ] The help command should toggle the instructions panel.
- [ ] There shouldn't be an X button in the top right corner.
- [ ] The abandon button hasn't been implemented correctly according to the wireframe. -> which wireframe?
- [ ] Currently, when changing views (schedule/texts/history) the width of the base element is changing. This is bad for UX. So we need to set the width (and while we're at it, also the height) of the base view element (the div under main) so that the dimensions stay consistent. I tested this in devtools and it produced the desired effect: element {width: 80vw; height: 80%;}

### Needs Refinement

- [ ] Set styles for tutor output (possibly in a box with a light colored background and in effect a separate stylesheet)
    - need to fix the scroll behavior. the user always has to scroll up to view the beginning of the content. maybe a side bar similar to instructions.
        - then you could have a pill similar to the "replayed" one which you can click to open the side panel. Although initially it will open itself.
        - need a wireframe for this.
    - I'm now thinking all command outputs should be discernible in a uniform way, such as a small component-look like a border, some padding and a background, along with a tiny indicator of the command used. but perhaps this should be for answer, and showdiff only. Tutor is a bit different. And replay is different again. Keep is similar to replay (as in no text content or app message is logged to the console.)
- [ ] Consider using structured outputs for tutor responses, and then format them for the output/console. This will provide more consistency.
- [ ] Change "Attempt Input" label to something else (maybe nothing).
- [ ] The replay command should add a small component to the log (using html) saying "clip x replayed".

## P1

- [ ] The "Due Today" label in the schedule view should be green not yellow.
- [ ] There should not be a replay button in the top right. Currently the tutor spinner is rendered here. Move that to another location because this is being removed.
- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Make the tutor spinner more pronounced.
- [ ] Option for dark mode and system default
- [ ] The deletion confirmation dialog was not implemented.
- [ ] Help text needs a lot of love. including using the help command to toggle the instructions panel. and the up/down arrow history feature.

## P2

- [ ] The "start next session" button shouldn't start a session from the upcoming box. Only overdue and today. This is shown in the schedule view wireframe.
- [ ] I want to know the spread of the score points per clip.
- [ ] On the schedule view, it says plan and launch your next sessions. It should say view your schedule and launch your next session.
- [ ] The calendar panel on the schedule view is too narrow, it needs to be wider so that there's no overflow of the session indicator pills within the day boxes.
