# TODO

## P0

### Ready

- [ ] Tutor combines two errors into one correction. Be more detailed in the prompt that each error that the user makes needs its own correction.
- [ ] Implement exponential retry and backoff logic for tutor responses
- [ ] The "Due Today" label in the schedule view should be green not yellow.
- [ ] Session dialog: There should not be a replay button in the top right. It just needs to be removed. So the header element will contain the elements which are currently in its first child div. maintain the existing flexbox settings so that the content is spread across the top (text name — clip number — score).
- [ ] Session dialog: Remove the "Attempt Input" label.

### Needs Refinement

- [ ] Check the next launch target calculation. It should be older texts first.
- [ ] On the schedule view, it says plan and launch your next sessions. It should say view your schedule and launch your next session.
- [ ] The calendar panel on the schedule view is too narrow, it needs to be wider so that there's no overflow of the session indicator pills within the day boxes.

## P1

### Ready


### Needs Refinement

- [ ] Deal with the overflow of main (the background radial gradient cuts off).
    - The windows within the base views should be scrollable.
    - The overall view element needs to be larger and I don't like the floating look.
    - This all needs to be wireframed.
- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Option for dark mode and system default
- [ ] Help text needs a lot of love. including using the help command to toggle the instructions panel. and the up/down arrow history feature.

## P2

- [ ] I want to know the spread of the score points per clip.

## P3

- [ ] Convert to a desktop app
- [ ] Landing page for the project
- [ ] Open source deployment (via docker)
- [ ] Stop saving tutor responses to DB
- [ ] Improve tutor output styles
    - currently it's blue and slate inside the purple. It should be only purple accent and backgrounds.
    - the "Tutor responded" text should be in the same purple as the "Tutor called" component.
