## 0.1.0
- [x] (pwebm-helper) add a keybinding to show the status of the encoding on the mpv window
- [x] no log file flag
- [ ] add no log file flag to the docs
- [ ] when erroring out encoding an item, just log the error and move on to the next item (save the exit code)
- [ ] update the status on the terminal right away when adding a new item to the queue
- [ ] rename tries prop in status to try
- [ ] document status in the readme
- [ ] pass file to select in the -subs option
- [ ] pass false to -subs to disable subtitles (if enabled in the config)

### Might be nice to have
- [ ] add limit for the amount of tries to redo a conversion
- [ ] percentage bitrate offset when retrying a conversion with new calcs
- [ ] handle no duration case, maybe adding an additional crf mode instead of bitrate calcs
- [ ] multiple encodings at the same time
