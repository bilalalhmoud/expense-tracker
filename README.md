# 💰 Expense Tracker (PWA)

A clean, offline-first web app to replace an Excel-based monthly expense tracker.
Built with **plain HTML, CSS, and JavaScript** — no frameworks, no build step,
no backend. All data lives in your browser via `localStorage`, and it installs
as a Progressive Web App (PWA) on laptop and mobile.

## ✨ Features

- **Monthly dashboard** — enter income, see total expenses, amount paid, and
  remaining balance (green when positive, red when negative).
- **Expense management** — add, edit, and delete expenses with name, category,
  amount, type (fixed / variable), and due date.
- **Payment tracking** — toggle a "Paid" indicator (paid rows turn green);
  filter by Paid / Unpaid and by Fixed / Variable.
- **Fixed expenses carry over** — starting a new month copies fixed expenses
  forward (reset to unpaid) and preserves history.
- **History view** — browse past months with income / expenses / balance, and
  jump back into any month.
- **Charts** — income-vs-expenses bar chart and a by-category donut chart,
  drawn with the native Canvas API (no external libraries → fully offline).
- **Dark mode** toggle.
- **Export / Import** all data as JSON for backup or transfer.
- **Offline-first PWA** — installable, works with no connection.

## 📁 Project structure

```
Expenses/
├── index.html          # App markup + tab layout
├── styles.css          # Responsive, mobile-first styles + dark theme
├── app.js              # State, CRUD, calculations, charts, PWA registration
├── manifest.json       # PWA metadata (name, icons, colors)
├── service-worker.js   # Offline caching of the app shell
├── icons/
│   ├── icon.svg        # Scalable app icon
│   ├── icon-192.png    # Install icon (small)
│   └── icon-512.png    # Install icon (large / maskable)
└── README.md
```

## ▶️ Run locally

A service worker requires the app to be served over `http(s)` (not opened via
`file://`). Use any static server:

**Python (built-in):**
```bash
cd Expenses
python -m http.server 8080
```
Then open <http://localhost:8080>.

**Node:**
```bash
npx serve .
```

**VS Code:** install the *Live Server* extension and click **Go Live**.

## 🚀 Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**,
   choose your branch (e.g. `main`) and folder `/ (root)`, then **Save**.
4. Your app will be live at `https://<username>.github.io/<repo>/`.

> All paths in the app are relative, so it works from a project subpath on
> GitHub Pages without changes.

## 🗃️ How data is stored

Everything is kept in `localStorage` under the key `expense-tracker-v1`:

```jsonc
{
  "currency": "$",
  "theme": "light",
  "currentMonth": "2026-06",
  "months": {
    "2026-06": {
      "income": 5000,
      "expenses": [
        { "id": "abc", "name": "Rent", "category": "Housing",
          "amount": 1200, "type": "fixed", "due": "2026-06-01", "paid": true }
      ]
    }
  }
}
```

Data persists across sessions on the same browser/device. Use **Settings →
Export JSON** to back it up, and **Import JSON** to restore or move devices.

## 🔄 Updating the app

The service worker caches the app shell. After changing any file, bump
`CACHE_VERSION` in [`service-worker.js`](service-worker.js) so browsers fetch
the new version on next load.

## 📝 License

Free to use and modify.
