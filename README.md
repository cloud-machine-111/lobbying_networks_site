## Social Networks in Environmental Lobbing
[Explore!](https://cloud-machine-111.github.io/lobbying_networks_site/)

## Todo:
- make UX less soulless
 
data:
- There are a few instances of edges where nodes no bills in common, but I think it's either a post-processing error (zz bills), or maybe the infomap algorithm jumping between disconnected subgraphs--if the latter, I'll drop those edges.

interactivity:
- remove physics animation when jumping between years
- keep node in selection when jumping between years
- add weight type to json metadata

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
