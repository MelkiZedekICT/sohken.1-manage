# Sohken public page

The `web/` folder is a static website. It has no sign-up form, database, analytics or payment code. Its text check runs in the browser, and download buttons open GitHub Releases.

To publish with GitHub Pages, first enable **Settings → Pages → Build and deployment → GitHub Actions** in the repository. Then run **Actions → Sohken checks, downloads and website → Run workflow** and choose `publish-site`. A routine code push does not publish the page. Publish the alpha release before directing users to the download links.

The desktop app runs on the user's computer. It is not a shared hosted service. The optional npm advisory lookup sends package names and versions to Google's OSV service only after a user opts in; it does not send source files.