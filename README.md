# Albert macOS Dock

A customized GNOME Shell dock experiment focused on macOS-style icon magnification, smooth pointer-following animation and dock interaction behavior.

## Upstream attribution

This repository is based on **Dash to Dock**. The repository metadata retains the original author reference (`micxgx@gmail.com`) and upstream project URL:

https://micheleg.github.io/dash-to-dock/

Dash to Dock is distributed under GPLv2+. This repository retains the GPL license in `COPYING`.

This project should therefore be understood as a **modified/fork-derived GNOME Shell extension**, not as a from-scratch replacement for Dash to Dock.

## What I changed / explored

The main focus of my modifications is dock magnification behavior:

- Continuous macOS-style icon scaling
- Neighbor displacement to reduce overlap
- Pointer-following magnification wave
- Smoothing/interpolation controls
- GSettings-backed configuration
- Dock geometry handling while icons are enlarged

## Why this project is useful to me

It gave me hands-on experience with:

- GNOME Shell extension internals
- JavaScript in the GNOME/GJS environment
- Clutter actor geometry
- GSettings
- Linux desktop customization
- Event-driven UI behavior
- Modifying and understanding an existing open-source codebase

## Configuration

Available magnification settings include:

| Setting | Purpose |
|---|---|
| `magnification-enabled` | Toggle magnification |
| `magnification-max-scale` | Maximum icon scale |
| `magnification-radius` | Number of nearby icons influenced |
| `magnification-displacement` | Shift neighbors as icons enlarge |
| `magnification-smoothing` | Animation responsiveness |

Example:

```bash
gsettings set org.gnome.shell.extensions.albert-macos-dock magnification-max-scale 1.8
```

## Build / install

```bash
git clone https://github.com/Albert101255/albert-macos-dock.git
cd albert-macos-dock

sudo apt install make gettext sassc
make && make install
```

On Wayland, log out and back in after installation if required.

## Architecture notes

The extension works inside GNOME Shell's actor/layout system. Important areas include:

- `docking.js` — dock container and lifecycle behavior
- `dash.js` — application icon/dash logic
- magnification-related logic — pointer tracking, scaling and displacement
- `schemas/` — GSettings configuration

## Project status

This is a customization and learning project based on existing GPL software. Future documentation should include a short demo GIF and a more exact diff-style explanation of the magnification changes compared with upstream Dash to Dock.

## License

GPLv2+ — see `COPYING`.
