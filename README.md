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
- Log file, tracking everything that is happening (I'm a sucker for these)
- Generated file names with unix timestamps

The encoding with first crf mode, and then bitrate (when failing) was my way of encoding webms, and I wanted to automate this very same process. Having a queue was essential to keep selecting multiple segments to encode without waiting for the previous one to end, this meant I could keep using mpv and then later check at the end the resulting webms. I also loved the idea of having a log file that I could track with `tail -f`. Personally, I have been using tail/multitail on my Linux boxes to track logs for the longest time, so this was hugely inspired by this. When uploading files on some imageboards, the file name generated on the server uses the unix timestamp, so I wanted to keep the same format. I use the same naming format for my screenshots as well.

Following these requirements, I wrote an early version of the script in Python named [PureWebM](https://github.com/4ndrs/PureWebM), which was a simple script that would encode webm files with a size limit, and would retry encoding with a lower bitrate if the limit was reached. It would also handle multiple encoding requests in a queue, and log everything that was happening in a file.

The script worked fine for me for 2 years, but maintenance and installation on new machines became a painful experience with Python. The codebase was hard to look at (it was written in my early days with python), and I strongly wanted to improve it using a more modern approach, so I decided to rewrite it from scratch in TypeScript, and this is the result.

This new version is a lot more organized, and was written with cross-platform compatibility in mind, like using named pipes on Windows instead of unix sockets, and properly handling paths with `path.join()` instead of using hard coded paths. Unfortunately at the time of this writting, I haven't been able to test it on Windows yet, but the foundation is there for anyone who wants to try it out.

The script was mainly written to use with [PureMPV](https://github.com/4ndrs/PureMPV) and [pwebm-helper](https://github.com/4ndrs/pwebm-helper), but it can be used independently as well, if you are comfortable with the command line.

## Usage

[Usage Preview](https://github.com/user-attachments/assets/1800f80c-db37-4fd4-9652-3e68aeb645d5)
