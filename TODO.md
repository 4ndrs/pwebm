config, log ->  there has to be a way to retrieve the config dir with env variable or some api
(socket)        similar to purewebm; have to be in ~/.config/pwebm/config, ~/.config/pwebm/log
                the socket file (if there is any) goes to /tmp

videos dir ->   use ~/Videos/pwebm for consistency as default, but make it changeable through
                the config file ASAP, way to many webms in PureWebM to move to another dir

filename   ->   use the unix timestamp with 16 digits (performance.now() + performance.timeOrigin)
                the --name_type flag won't be ported

flags      ->   -v/--version, -h/--help, --status, --kill, -i, -subs, -c:v, -ss, -to, -lavfi,
                --size_limit/-sl, -crf, -cpu-used, -deadline, --extra_params/-ep


some considerations:
    - not being v1.0 permits for some leeway with breaking changes
    - default size limit will be increased from 3 to 4
    - if --status or --kill are used other flags will be ignored, consider maybe direct commands?
    - current purewebm needs the start/end times in the metadata of the file to work no matter what
      need to find a different way to get these, or at least not rely on them when they are set
      manually
    - it has to work with PureMPV (through pwebm-helper), tail log is nice but would be also nice
      to have some kind of keybinding on the helper to show the status of the encoding on the mpv
      window

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
- [ ] update readme
- [ ] add subs flag warning to the readme (how it works, output seeking needed, etc)

### Might be nice to have
- [ ] add limit for the amount of tries to redo a conversion
- [ ] percentage bitrate offset when retrying a conversion with new calcs
