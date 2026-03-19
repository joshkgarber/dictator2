# TODO

## P1

### Needs Refinement

- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Option for dark mode and system default
- [ ] Help text needs a lot of love. including using the help command to toggle the instructions panel. and the up/down arrow history feature.
- [ ] Command to show the translation: costs less than an answer

## P2

- [ ] I want to know the spread of the score points per clip.
    - so that I can see which clips are causing the most problems

## P3

### Needs Refinement

- [ ] Cost structure: maybe you have to buy credits (which are very cheap for running sessions and commands, but tutor costs a lot)
    - like you can do virtually unlimited sessions for $10 but tutor calls cost the equivalent of 5c
- [ ] Noun gender side-quest (suggested when mistake is gender-related i.e. as a side-quest only after tutor has been invoked)
    - Costs credits but creates a sub-score which doesn't accumulate to session score
    - Tutor always returns all nouns with their gender, along with their singular and plural forms.
        - Optional or Higher tier in paid version (different prompt for more money (because it creates more output))
- [ ] Multiplayer/community
    - [ ] Community can contribute texts
        - Public vs private texts (once public always public, but can be archived)
            -  Public texts are reviewed for accuracy by AI and final approval by a human
    - [ ] Public texts have a score leaderboard
- [ ] Anti-cheat
- [ ] Convert to a desktop app
- [ ] Landing page for the project
- [ ] Open source deployment (via docker)
- [ ] Stop saving tutor responses to DB
- [ ] Improve tutor output styles
    - currently it's blue and slate inside the purple. It should be only purple accent and backgrounds.
    - the "Tutor responded" text should be in the same purple as the "Tutor called" component.
