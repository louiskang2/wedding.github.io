# Carley & Louis — Wedding Website

A lightweight wedding site built with **Jekyll** (for GitHub Pages) on the front end
and **Google Sheets + Google Apps Script** as a free backend for guest verification
and RSVPs. Uses only Bootstrap, jQuery, and Flickity (all from CDN — nothing to install).

---

## 1. Run it locally

You need Ruby (3.x) with Bundler. On macOS: `brew install ruby`; on Windows use
[RubyInstaller](https://rubyinstaller.org/) (check "install MSYS2 devkit").

```bash
cd wedding-site
bundle install
bundle exec jekyll serve
```

Open **http://localhost:4000**. Done.

### Demo mode (no Google setup needed)

While `apps_script_url` in `_config.yml` is empty, the site runs in **demo mode**
with a built-in sample guest list. Try entering on the landing page:

| First name | Last name | What you'll see |
|---|---|---|
| `Alex` *or* `Alexander` | `Tanaka` | Solo guest **with** a plus-one allowed (shows alternate first names) |
| `Jamie` | `Lee` | Party of 3 (two adults + one child) |
| `Sofia` | `Rossi` | Couple with a plus-one allowed |
| `Haruto` | `Sato` | Solo guest, no plus-one |
| `Emma` | `Schmidt` *or* `Smith` | Solo guest with an alternate last name |

Note how `Alex`/`Alexander` and `Schmidt`/`Smith` both let the same guest in —
see "Alternate names" below.

In demo mode, RSVP submissions are held in memory (check the browser console) and
prefill correctly if you resubmit during the same session.

---

## 2. Set up the real backend (Google Sheets + Apps Script)

1. **Create the spreadsheet.** Go to [sheets.new](https://sheets.new). Name it
   anything (e.g. *Wedding Guests*).
2. **Import the guest list.** File → Import → Upload → choose
   `sample-data/Guests.csv` → Import location: **Replace current sheet**.
   Then double-click the tab at the bottom and rename it to exactly **`Guests`**.
   - Columns: `PartyID | FirstName | LastName | Type | PlusOneAllowed`
   - Everyone with the same `PartyID` is on one invitation and sees each other's names.
   - `Type` is `Adult` or `Child`. `PlusOneAllowed` is `Yes` or `No`
     (Yes for anyone in a party = that party may add one guest).
   - **Alternate names:** a `FirstName` or `LastName` cell may list several
     accepted spellings separated by commas, e.g. `Robert, Bob, Bobby` or a
     maiden/married name like `Schmidt, Smith`. The guest gets in by typing
     **any** of the first-name options together with **any** of the last-name
     options, so nicknames and name changes both work. The **first** option
     listed is the one shown on the site (in the welcome message and the RSVP
     name chips), so put the name you'd like displayed first. In a spreadsheet
     you can just type `Robert, Bob` in the cell; in the CSV such a cell is
     wrapped in quotes (`"Robert, Bob"`) so the comma isn't read as a new column.
   - Replace the sample rows with your real guest list whenever you like.
3. **Add the script.** In the spreadsheet: Extensions → **Apps Script**. Delete
   whatever is in `Code.gs` and paste the entire contents of
   `apps-script/Code.gs` from this project. Click the 💾 save icon.
4. **Deploy it.** Click **Deploy → New deployment** → gear icon → **Web app**.
   - Description: anything
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize with your Google account (you'll see an
     "unverified app" warning because you wrote the script — click Advanced →
     Go to project), then **copy the Web app URL** (ends in `/exec`).
5. **Connect the site.** In `_config.yml`, paste the URL:
   ```yaml
   apps_script_url: "https://script.google.com/macros/s/XXXXX/exec"
   ```
   Restart `bundle exec jekyll serve` (config changes require a restart).

An **`RSVPs`** tab is created automatically on the first submission. Resubmissions
**replace** a party's old rows, so the sheet always shows everyone's latest answers.
An **`RSVP log`** tab is created alongside it with the same columns, but nothing is
ever removed from it — every submission is appended, so an overwritten answer can
always be recovered. Rows from one submission share a `Timestamp`.

> If you edit `Code.gs` later, you must **Deploy → Manage deployments → ✏️ Edit →
> Version: New version → Deploy** for the change to go live.


---

## 3. Editing content (no coding needed)

**Global details** — names, date, venue: edit `_config.yml`.

**Sections** — every section on every page is one Markdown file in `_sections/`:

```
---
group: travel        # which page: main | info | travel | snow
order: 2             # position on the page
slug: tokyo-guide    # used for the URL anchor (#tokyo-guide)
title: Tokyo Guide   # shown as the section heading on the page
---
Your content in Markdown…
```

Add a section = add a file. Remove a section = delete the file. Reorder = change `order`.

**Embeds** — drop these lines anywhere inside a section:

```liquid
{% include figure.html src="/assets/img/photo.jpg" alt="Description" caption="Optional" %}
{% include youtube.html id="dQw4w9WgXcQ" caption="Optional" %}
{% include map.html query="Kenchoji Temple, Kamakura" caption="Optional" %}
{% include carousel.html images="/assets/img/a.jpg,/assets/img/b.jpg,/assets/img/c.jpg" %}
```

Put your own photos in `assets/img/` (the current images are generated placeholders).

**Design theme** — clean, hand-drawn feel with simple geometry: ink borders
with straight (vertical + horizontal) edges and plain straight rules. No
image assets are used for any of the chrome — it's all CSS. See `_sass/_theme.scss`.

### The landing scene

The hero is a **backdrop photo** with small **decoration drawings** that fade
in on top of it, one after another. Everything is set in one place —
the `landing:` block of `_config.yml`:

```yaml
landing:
  backdrop: backdrop.jpg
  decorations:
    - { file: dango.png, size: 10, x: 74, y: 20 }   #  1 o'clock
    - { file: fish.png,  size: 13, x: 22, y: 74 }   #  8 o'clock
```

**To add another drawing:** drop a transparent PNG into
`assets/img/scene/` and add one line to that list. It automatically becomes
the next one to appear, and the date banner / names / gate shift later to
wait for it. There is no CSS or template to edit.

| Field | Meaning |
|-------|---------|
| `file` | filename inside `assets/img/scene/` |
| `size` | width as a % of the window's **shorter** side (`10` ≈ 10%) |
| `x`, `y` | where the **centre** of the drawing sits, as a % of the window (`x`: 0 = left, 100 = right · `y`: 0 = top, 100 = bottom) |

The names sit in the middle of the screen, so keep decorations toward the
edges — `_config.yml` lists handy clock positions to copy from. Drawings are
drawn *behind* the text, so even a badly placed one can never make the names
unreadable.

A gentle dark wash sits over the photo so pale drawings and the text stay
readable on bright areas. Adjust or remove it with `--scrim` (default `.3`,
`0` for none) in `_sass/_theme.scss`.

### How the landing sequence behaves

The backdrop photo fades in first, then each decoration fades in one at a
time, then the date banner, the names and the entry box — **only on a fresh
visit**, i.e. someone typing the site address. Once a guest has entered their
name, every return to Home (clicking "Home" in the nav, reloading, or
re-typing the address in the same session) shows the finished scene
instantly, with no fade-in.

The tempo is set in `_sass/_site.scss` (`--decor-start` = when the first
drawing appears, `--decor-step` = the wait between drawings).

**On narrow screens**, where the names box drops to the bottom of the window,
the `x`/`y` values are ignored and the drawings instead line up in a row in
the gap between the date banner and the names box — in the same order.

### Changing the artwork itself

Everything the landing uses lives in `assets/img/scene/`: the backdrop photo
plus one PNG per decoration. Swap them freely — the only rule is that
decoration PNGs should have transparent backgrounds.

Large photos are worth shrinking first; the shipped backdrop was reduced from
33 megapixels to 2200px wide (about 350 KB). With ImageMagick:

```bash
magick backdrop-original.jpg -resize 2200x -quality 82 assets/img/scene/backdrop.jpg
```

The UI chrome (frame borders, the nav rule, title bars, hover underlines) needs
**no image assets at all** — it's drawn in CSS from `--line`, `--rad`,
`--nrule-h`, `--nbar-h` and `--tbar-h` in `_sass/_theme.scss`.

## 5. How it works (map of the code)

```
_config.yml               site settings + Apps Script URL
index.html                landing sequence + main page (Wedding / Afterparty / Shuttle)
wedding-info.md           page shells — content comes from _sections/
travel-guide.md
snow-trip.md
rsvp.html                 RSVP wizard shell (logic in assets/js/rsvp.js)
_sections/*.md            ← ALL page content lives here
_layouts/                 default.html (chrome), page.html (hero + sections)
_includes/                top nav, embed helpers (figure/youtube/map/carousel)
_sass/_theme.scss         ← ALL design variables live here
_sass/_site.scss          component styles
assets/js/api.js          talks to Apps Script (or demo data)
assets/js/landing.js      name gate + fade-in sequence
assets/js/main.js         access gating, top-nav & content reveal
assets/js/rsvp.js         RSVP wizard
apps-script/Code.gs       ← paste into Google Apps Script
sample-data/Guests.csv    ← import into Google Sheets ("Guests" tab)
```

**Flow:** a guest types their name → the site asks Apps Script to find them in the
`Guests` sheet → if found, the landing fades into the main site and their whole
party is remembered for the session. On the RSVP page they can add a plus-one
(if allotted) and children, answer questions per person, and submit — the script
writes one row per person to the `RSVPs` tab, replacing any earlier submission.

**A note on security:** guest verification is a courtesy gate, not real security —
anyone with a name from the list (or reading the page source in demo mode) can get
in. That's the intended trade-off for a zero-cost, login-free wedding site.

---

## Troubleshooting

- **"Couldn't find that name"** — the name must match the sheet exactly (spacing
  aside; matching is case-insensitive). Check the `Guests` tab spelling.
- **"Something went wrong during verification" on the landing page, or an RSVP that
  won't send** — these are the two places the backend is actually called. Re-check
  the Apps Script deployment: access must be **Anyone**, and the URL in `_config.yml`
  must be the `/exec` URL. Redeploy a **new version** after any script edit.
- **Blank RSVP page** — the backend isn't involved; the party is already in
  `sessionStorage` by then. Check the browser console for an error in
  `assets/js/rsvp.js`.
- **Blank styles locally** — make sure you ran `bundle exec jekyll serve` from the
  project folder and are viewing `localhost:4000`, not opening the HTML file directly.
- **Broken links on GitHub Pages** — set `baseurl` (see section 3).
