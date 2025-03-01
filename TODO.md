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
- [ ] convert webm, retry when limit reached
- [ ] convert any other encoder to mkv copied streams just like purewebm
- [ ] handle queue
- [ ] ffmpeg progress
- [ ] handle signals
- [ ] name the process
- [ ] socket file for communication
- [ ] kill implementation
- [ ] status implementation
- [x] version implementation
- [x] help implementation
- [ ] add automatic releases with github actions (edge + tagged)
- [ ] add bun bundled executable package releases to the automatic releases
- [ ] update readme
- [ ] add subs flag warning to the readme (how it works, output seeking needed, etc)
- [ ] release tagged versions in npm
- [ ] it's not part of this repo, but don't forget to improve the helper script for PureMPV (pwebm-helper), it has a missing readme

### the following is just extra not implemented on purewebm but was its initial vision (can skip)
- [ ] implement conversion logger view (save previous conversions to db with last bitrate info)
- [ ] redo conversions in logger view
- [ ] add limit for the amount of tries to redo a conversion
- [ ] percentage bitrate offset when retrying a conversion with new calcs

## 2025-02-29
- [x] add ffmpeg utils
- [x] handle first ffmpeg webm encoding
- [x] use unix timestamp for filename when no output file
- [x] out time can be N/A
- [x] two pass
- [x] rename pass file
- [x] clean up pass file after encoding/termination
- [x] encode
- [x] kill
- [x] handle size limits hits with a callback in the stdout processing
- [x] convert timestamps to seconds
- [x] parse metadata for multiple inputs with a single schema
- [x] deduce duration
- [x] retry webm conversion if limit reached and encoding not done yet
- [x] retry webm conversion if limit reached when encoding is done
