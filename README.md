# Albert macOS Dock

A high-performance, rock-solid macOS-style dock extension for GNOME Shell built with smooth dynamic magnification, continuous anchor tracking, neighbor displacement, and zero-glitch geometry isolation.

![GNOME Shell Extension](https://img.shields.io/badge/GNOME%20Shell-46%2B-blue.svg)
![License](https://img.shields.io/badge/License-GPLv2%2B-green.svg)
![Platform](https://img.shields.io/badge/Platform-Linux%20%2F%20Wayland%20%2F%20X11-orange.svg)

---

## ✨ Features

- 🌊 **Smooth Cosine Magnification Wave**: Icons grow smoothly in a continuous cosine wave as the pointer glides across the dock. The magnification peak follows the cursor with precision.
- ↔️ **Non-Overlapping Neighbor Displacement**: Neighboring icons shift laterally to make room for magnified icons, ensuring zero icon overlap or visual clutter.
- ⚓ **Continuous Sub-Pixel Anchor Interpolation**: Eliminates jarring position jumps when transitioning across icon boundaries.
- 🔒 **Immutable Baseline Geometry**: Baseline unmagnified layout metrics are captured at pointer enter and restored deterministically on exit.
- 🛡️ **Cross-Axis Overflow Zone**: Active interaction rectangle dynamically expands beyond the dock frame, allowing seamless hover over the peak of magnified icons without collapse.
- ⚙️ **Native GTK4 Preferences**: Full customization suite integrated directly into the extension preferences window via GSettings.
- ⚡ **Clean & Leaking-Free Lifecycle**: Modular architecture using GLib mainloop frame timers and explicit signal handler disconnections.

---

## ⚙️ Customization & Settings

You can adjust all magnification parameters through the **Extension Preferences UI** or directly via `gsettings`:

| Setting Key | Description | Default | Range |
| :--- | :--- | :---: | :---: |
| `magnification-enabled` | Enable or disable macOS-style icon magnification | `true` | `true` / `false` |
| `magnification-max-scale` | Peak magnification scale factor for hovered icons | `1.65` | `1.00` – `2.50` |
| `magnification-radius` | Influence radius of the scale wave (in icon width units) | `2.50` | `1.00` – `5.00` |
| `magnification-displacement` | Enable non-overlapping lateral icon displacement | `true` | `true` / `false` |
| `magnification-smoothing` | Frame interpolation smoothing factor (responsiveness) | `0.35` | `0.10` – `1.00` |

### Command-Line Tuning via GSettings

```bash
# Set peak magnification scale to 1.8x
gsettings set org.gnome.shell.extensions.albert-macos-dock magnification-max-scale 1.8

# Adjust magnification wave radius
gsettings set org.gnome.shell.extensions.albert-macos-dock magnification-radius 3.0

# Set frame interpolation responsiveness
gsettings set org.gnome.shell.extensions.albert-macos-dock magnification-smoothing 0.40
```

---

## 🛠️ Building & Installation

### Prerequisites

Ensure you have `make`, `gettext`, and `dart-sass` or `sassc` installed:

```bash
sudo apt update
sudo apt install make gettext sassc
```

### Installation from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/Albert101255/albert-macos-dock.git
   cd albert-macos-dock
   ```

2. Build and install to user extensions directory:
   ```bash
   make && make install
   ```

3. Compile GSettings schemas:
   ```bash
   glib-compile-schemas ./schemas/
   sudo cp schemas/org.gnome.shell.extensions.albert-macos-dock.gschema.xml /usr/share/glib-2.0/schemas/
   sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
   ```

4. Restart GNOME Shell:
   - **X11**: Press <kbd>Alt</kbd> + <kbd>F2</kbd>, type `r`, and press <kbd>Enter</kbd>.
   - **Wayland**: Log out and log back in.

5. Enable the extension:
   ```bash
   gnome-extensions enable albert-macos-dock@local
   ```

---

## 🏛️ Architecture Overview

The extension adopts a decoupled, isolated architecture designed specifically for GNOME Shell's Clutter scene graph:

```
                  ┌─────────────────────────────────┐
                  │    DockDash / SlideContainer    │
                  └────────────────┬────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         ▼                   ▼
               ┌──────────────────┐ ┌─────────────────┐
               │   DockMagnifier  │ │   Preferences   │
               │  (magnifier.js)  │ │   (prefs.js)    │
               └─────────┬────────┘ └─────────────────┘
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
┌───────────┐     ┌──────────────┐   ┌──────────────┐
│ Wave Math │     │ Displacement │   │ Frame Loop   │
└───────────┘     └──────────────┘   └──────────────┘
```

- **`magnifier.js`**: Core module encapsulating `DockMagnifier`. Manages continuous 60fps GLib frame loops, cosine wave calculations, displacement accumulation, and baseline resets.
- **`docking.js`**: Controls dock container layout, clip region expansion, slide containers, and GSettings integrations.
- **`dash.js`**: Manages the main icon box hierarchy, actor offscreen redirection states, and magnifier lifecycle hooks.
- **`schemas/`**: Defines the GSettings XML schema ID `org.gnome.shell.extensions.albert-macos-dock`.

---

## 📜 License

Distributed under the terms of the **GNU General Public License v2.0 or later** (GPLv2+). See the [COPYING](COPYING) file for full details.
