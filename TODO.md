## Stuff

- [x] argument parser
- [x] expand tilde and $HOME in config video path
- [x] check for ffmpeg and ffprobe in path
- [x] convert webm, retry when limit reached
- [x] convert any other encoder to mkv copied streams just like purewebm
- [x] socket file for communication
- [x] handle queue
- [x] kill implementation
- [x] ffmpeg progress
- [x] status implementation
- [x] handle signals
- [x] name the process
- [x] version implementation
- [x] help implementation
- [x] args.ts help is missing dynamic default for crf
- [x] if input is missing after some other arg, the default parse error is shown
- [x] warn color is messed up for the message shown when the file limit is reached because of default warn color
- [x] implement better cleaning process before exit
- [x] release tagged versions in npm
- [x] it's not part of this repo, but don't forget to improve the helper script for PureMPV (pwebm-helper), it has a missing readme
- [x] update readme
- [x] add subs flag warning to the readme (how it works, output seeking needed, etc)

### Might be nice to have
- [ ] add limit for the amount of tries to redo a conversion
- [ ] percentage bitrate offset when retrying a conversion with new calcs
- [ ] handle no duration case, maybe adding an additional crf mode instead of bitrate calcs
- [ ] (helper script) add a keybinding to show the status of the encoding on the mpv window
