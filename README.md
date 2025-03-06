# pwebm

Utility to encode size restricted webm files with ffmpeg.

When executed multiple times, the additional encoding requests will be put inside a queue that will be handled in the first instance that was executed.

When not specified, the output file name will be the current unix timestamp (with 13 digits plus 3 random additional ones, e.g.: `1741140729397902.webm`), and saved in `~/Movies/pwebm/` (macOs) or `~/Videos/pwebm/` (all others).

# Installation

This is a CLI that makes use of [Bun](https://bun.sh/) APIs internally, so having bun installed in your system for it to work is a requirement.

The package is available in the official npm registry, so you can install it globally with:

```bash
bun i -g pwebm
```

Or if you prefer installing the repo directly from GitHub (with the latest commits):

```bash
bun i -g git+https://github.com/4ndrs/pwebm.git
```

>[!NOTE]
>There is no build step for this script; the source code is used and executed as is. You can check, and follow its [entry point](./pwebm) to see how it works.

## Historical Background & Purpose

In 2022, I wrote a script for the mpv media player called [PureMPV](https://github.com/4ndrs/PureMPV) that would help extracting the currently watched video's information, like the timestamps at certain points, and the the cropping coordinates, which would then later be used for encoding videos with ffmpeg with specific parameters.

Up to that point, I mostly spent the time encoding short webm files to keep and share on some imageboards, as well as encoding some mkv files with streams and attachments copied, so I wanted to integrate this functionality in some way with PureMPV. I didn't like the idea of having PureMPV to do the encoding itself, I wanted a seperate process to handle this independently, so I could stop or start another mpv window without affecting the encoding process. I wrote down some of the initial requirements at the time, which were the following:

- Encoding webm files with size limits (first crf mode, then bitrate mode on retries)
- Having a queue for handling multiple encodings
- Log file tracking everything that is happening (I'm a sucker for these)
- Generated file names with unix timestamps

The encoding with first crf mode, and then bitrate (when failing) was my way of encoding webms, and I wanted to automate this very same process. Having a queue was essential to keep selecting multiple segments to encode without waiting for the previous one to end, this meant I could keep using mpv and then later check at the end the resulting webms. I also loved the idea of having a log file that I could track with `tail -f`. Personally, I have been using tail/multitail on my Linux boxes to track logs for the longest time, so this was hugely inspired by this. When uploading files on some imageboards, the file name generated on the server uses the unix timestamp, so I wanted to keep the same format. I use the same naming format for my screenshots as well.

Following these requirements, I wrote an early version of the script in Python named [PureWebM](https://github.com/4ndrs/PureWebM), which was a simple script that would encode size limited webm files, and would retry encoding with a lower bitrate if the limit was reached. It would also handle multiple encoding requests in a queue, and log everything that was happening in a file.

The script worked fine for me for 2 years, but maintenance and installation on new machines became a painful experience with Python. The codebase was hard to look at (it was written in my early days with python), and I strongly wanted to improve it using a more modern approach, so I decided to rewrite it from scratch in TypeScript, and this is the result.

This new version is a lot more organized, and was written with cross-platform compatibility in mind, like using named pipes on Windows instead of unix sockets, and properly handling paths with `path.join()` instead of using hard coded paths. Unfortunately at the time of writing I haven't been able to test it on Windows yet, but the foundation is there for anyone who wants to try it out.

The script was mainly written to use with [PureMPV](https://github.com/4ndrs/PureMPV) and [pwebm-helper](https://github.com/4ndrs/pwebm-helper), but it can be used independently as well, if you are comfortable with the command line.

## Usage

[Usage Preview](https://github.com/user-attachments/assets/1800f80c-db37-4fd4-9652-3e68aeb645d5)

The script has different arguments that can be used to customize the encoding process. They are similar to ffmpeg's arguments, meaning we have `-i` for selecting inputs, `-c:v` for selecting the video codec, `-ss` for the start time, `-to` for the end time, and so on. The script supports both output seeking and input seeking with multiple inputs if needed. Here is an exhaustive list of the currently available arguments:

|Argument|Details|
|----------|------|
|-h, --help| Show help message and exit|
|-v, --version| Show version and exit|
|-kill| Terminate the running pwebm instance, if there is any|
|-status| Show the current status of the encoding process|
|-i| The input file to encode|
|-ss| The start time of the segment to encode|
|-to| The end time of the segment to encode|
|-c:v| The video codec to use. Default is **libvpx-vp9**|
|-crf| The Constant Rate Factor to use. Default is **24**|
|-lavfi| The set of filters to pass to ffmpeg|
|-deadline| The deadline passed to ffmpeg for libvpx-vp9. Default is **good**|
|-cpu-used|The cpu-used passed to ffmpeg for libvpx-vp9. Default is **0**|
|-subs| Burn the subtitles|
|-sl, --size-limit| The size limit in MiB. Default is **4**|
|--video-path| The path to save the video files. Default is **~/Movies/pwebm/** on macOs, and **~/Videos/pwebm/** on everything else|
|-ep, --extra-params| Extra parameters to pass to ffmpeg|

If the codec option `c:v` is set to `libvpx` for v8 webms, or `libvpx-vp9` for vp9 webms, the script will generate a webm with the choosen options and size limit in MiB. If the codec is set to anything else, the script will generate an mkv file with all streams copied, including the attachments, and reencode the video stream with the choosen crf; no size limitations will be applied here.

The `subs` option will only trigger on webms, burning the subtitles onto the video stream. The internal implementation of this option is just picking the first input file's subtitles, and applying the subtitle filter to the resulting output. If you need to pick subtitles in a different file, you can use the `-lavfi` option to pass the subtitles filter manually for now.

>[!NOTE]
>The `subs` option doesn't work with input seeking. If you need to seek, make sure you are using output seeking, otherwise the resulting webm will have the subtitles burned at the wrong time.

The `size-limit` option sets the limit in MiB for the resulting webm file. If the file exceeds this limit, the script will retry encoding with a lower bitrate, and will keep retrying until the limit is met. The script will also keep track of the amount of retries, and will log this information in the log file. You can use `0` to disable the limit.

The `extra-params` option is a way to pass additional parameters to ffmpeg. This is an escape hatch, and can be used to replace internal defaults. Everything is passed as is, and there is no validation by the script, so make sure you are passing valid parameters.

### Examples
```bash
# Encode a webm without audio, with a size limit of 4 MiB, and save it in the default video path with a random file name
pwebm -i /tmp/Videos/nijinosaki.mkv

# Encode a webm with a specific file name
pwebm -i /tmp/Videos/nijinosaki.mkv /tmp/Videos/CUTE.webm

# Encode a segment with input seeking
pwebm -ss 00:00:02.268 -to 00:00:10.310 -i /tmp/Videos/nijinosaki.mkv

# Encode a segment with output seeking and burnt subtitles
pwebm -i /tmp/Videos/nijinosaki.mkv -ss 00:00:02.268 -to 00:00:10.310 -subs

# Encode a webm with size limit of 6 MiB and audio
pwebm -i /tmp/Videos/nijinosaki.mkv --size-limit 6 --extra-params -c:a libopus -b:a 128k

# Encode an h264 mkv with crf 24 and other streams copied
pwebm -ss 00:00:02.268 -to 00:00:10.310 -i /tmp/Videos/nijinosaki.mkv -c:v libx264
```

The script logs everything it does inside a log file located in `~/.config/pwebm/pwebm.log`, so you can check this file to see what params are used when executing ffmpeg. This file isn't currently rotated automatically in the script, so you might want to setup rotation with `logrotate` or similar.

## Configuration File

The defaults in the script can be configured with a configuration file located in `~/.config/pwebm/config.toml`. The file is a simple TOML file with the following options:

|Key|Equivalent|
|----------|------|
|encoder| -c:v|
|crf| -crf|
|deadline| -deadline|
|cpuUsed| -cpu-used|
|subs|-subs|
|sizeLimit| --size-limit|
|videoPath| --video-path|

Example:
```toml
crf = 28
subs = true
sizeLimit = 3
videoPath = "~/Videos/PureWebM"
```
