# Force Fitness Club — website

Live at **https://forcefitnesscy.com** (GitHub Pages, deployed from `main`).

## Closed dates — admin page

The owner manages closed dates at **https://forcefitnesscy.com/admin** (password protected, not linked from the site, `noindex`):
tap days on the calendar → optional EN/GR name → **Save**. The site updates in 1–2 minutes.

- Saved to `closed-dates.txt` (can also be edited by hand — format is explained at the top of the file).
- The top notice bar appears 3 days before each closure; the next 3 closures are listed in the Visit section; both hide once passed.

### One-time setup (site admin)
1. Create a GitHub **fine-grained token**: owner `ADSolutionsCRM`, only repo `force-fitness-concept`, permission **Contents: Read and write**, longest expiry allowed.
2. Open `/admin` → "First-time setup / change password" → paste the token, choose the owner's password.
3. The token is encrypted with that password (PBKDF2 600k + AES-GCM) and stored in `admin/key.json`. Re-run setup to change the password or when the token expires.
