# Sohken public page

This is a plain static website in `web/`. It has no server API, sign-up form, database, analytics, or payment code. The text check runs in the visitor's browser. Download buttons link to GitHub Releases.

To publish with GitHub Pages, enable **Settings → Pages → Build and deployment → GitHub Actions** in the repository. Then run **Actions → Publish Sohken website → Run workflow**. This workflow is manual so a routine code push does not publish the site. The page is public once the workflow completes. The release buttons point to the repository's Releases page; publish the alpha download release before directing users there.

The desktop alpha currently runs locally. It is not a shared hosted account service; its local project checks must never be enabled on a public app server. The optional npm advisory lookup discloses package names and exact versions to Google's OSV service only after the user opts in inside the local app.
