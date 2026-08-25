## Social Networks in Environmental Lobbing
[Click me to explore!](https://cloud-machine-111.github.io/lobbying_networks_site/)

## Todo:
priority:
- make actual nwks bigger in faceted
- fix issue where viewport of explorer is ugly when narrow screen
- make UX less soulless w images / diy layout / natgeo layout / pudding.cool layout / &&&! (see my web dev moodboard)
- make toggles for facets less ugly
- make a separate layout sheet just for text decorations (so you can wrap figures around that instead of wrapping them around Layout, which adds a footer & unneccessary padding.)

data:
- There are a few instances of edges where nodes no bills in common, but I think it's either a post-processing error (zz bills), or maybe the infomap algorithm jumping between disconnected subgraphs--if the latter, I'll drop those edges.
- Add downloadable link to full, cleaned datasets.

interactivity:
- remove physics animation when jumping between years
- keep node in selection when jumping between years
- add weight type to json metadata

Ideas for data journalism side:
 - Track a particular bill/relationship through time and data views--what political dynamics are revealed?
 - For each explorer view, also display yearly-flow-share graphs for all weight/log filters (it's quite striking how logging spending surfaces detailed relationships that aren't backed by disproportionate money; the side-by-side graphs encourage toggling!)
 

soc:
- add methodology section & writeup

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
