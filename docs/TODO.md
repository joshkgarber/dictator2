# TODO

## P0

### Ready


### Needs Refinement

- [ ] Set styles for tutor output (possibly in a box with a light colored background and in effect a separate stylesheet)
    - need to fix the scroll behavior. the user always has to scroll up to view the beginning of the content. maybe a side bar similar to instructions.
        - then you could have a pill similar to the "replayed" one which you can click to open the side panel. Although initially it will open itself.
        - need a wireframe for this.
    - I'm now thinking all command outputs should be discernible in a uniform way, such as a small component-look like a border, some padding and a background, along with a tiny indicator of the command used. but perhaps this should be for answer, and showdiff only. Tutor is a bit different. And replay is different again. Keep is similar to replay (as in no text content or app message is logged to the console.)

## P1

- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] There should not be a replay button in the top right. Currently the tutor spinner is rendered here. Move that to another location because this is being removed.
- [ ] The help command should toggle the instructions panel.
- [ ] Make the tutor spinner more pronounced.
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
