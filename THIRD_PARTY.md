# Third-party engine components

All rendering assets and level designs in this project are authored in code. No Snipperclips assets are included.

| Component | Version | Use | License |
| --- | --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 0.170.0 | WebGL scene, extruded geometry, lighting, shadows | [MIT](vendor/licenses/three.txt) |
| [Matter.js](https://github.com/liabru/matter-js) | 0.20.0 | Fixed-step planar rigid-body physics | [MIT](vendor/licenses/matter.txt) |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) | 0.15.7 | Polygon intersection and difference | [MIT](vendor/licenses/polygon-clipping.txt) |
| [Earcut](https://github.com/mapbox/earcut) | 2.2.4 | Triangulation of concave polygons and holes | [ISC](vendor/licenses/earcut.txt) |

Three.js is in `vendor/three.module.js`. The other three UMD distributions are embedded inside local CommonJS wrappers in `server.js` because the project backend requires one self-contained file. Browser modules re-export the exact same simulation.

The polygon-clipping distribution also contains Splaytree 3.1.2 (Alexander Milevski, MIT), robust predicate arithmetic ([public-domain dedication](vendor/licenses/robust-predicates.txt)), and a TypeScript helper notice from Microsoft under [Apache 2.0](vendor/licenses/Apache-2.0.txt). Their embedded notices are retained. Splaytree's MIT permission and warranty terms are provided in [its license notice](vendor/licenses/splaytree.txt). The current tslib package's [license notice](vendor/licenses/tslib.txt) is also included for reference.
