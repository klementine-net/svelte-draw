import{Q as e,Rt as t,X as n,w as r,x as i}from"../chunks/BLqagE9R.js";import"../chunks/BTNafl4p.js";import{t as a}from"../chunks/Dib62Zdo.js";var o=e(`<p>Klementine Draw is an infinite canvas for Svelte: the engine of a whiteboard, and the parts to
put one on a page. You draw, write, drag out shapes, connect them with arrows that stay
attached, add pictures and links, group and frame things, turn and snap them, copy and paste,
undo, on as many pages as you like. A board can be kept in the browser and stays in step across
tabs; it saves to a file and to a picture.</p> <p>Shapes and tools are plugins, also the ones that come with it. So the same engine can be a
whiteboard today and a design tool later, and a kind of shape your app needs is a class and a
Svelte component, not a fork.</p> <h2>What it is made of</h2> <p>Two layers, imported separately:</p> <table><thead><tr><th>Import</th><th>What it is</th></tr></thead><tbody><tr><td><code>@klementine/draw</code></td><td>the engine: plain TypeScript with no UI framework, so it runs in a browser, in a test and on a server alike</td></tr><tr><td><code>@klementine/draw/svelte</code></td><td>the Svelte layer: the canvas, the views of the built-in shapes, the toolbar, the panels, <code>Draw</code></td></tr></tbody></table> <p><a href="./concepts/">How it is built</a> explains the engine in five ideas.</p> <h2>Where it stands</h2> <p>Read this before you build on it.</p> <ul><li><strong>Early.</strong> It was built in a few days in November 2026. Much of it is covered by tests of the
engine (no browser); some of it has only been tried by hand, and a few parts never ran at all. <a href="./features/">What is built</a> says which is which, line by line.</li> <li><strong>Used by one app.</strong> Klementine Tiles, a place for teams and their AI agents to work on
shared documents, builds its board on it.</li> <li><strong>Not on npm yet.</strong> You get it from GitHub. The engine has no dependencies beyond two small
MIT libraries. The Svelte layer’s controls come from <strong>klementine.ui</strong>, a design system that is
not public yet, so for now the Svelte layer only builds with a copy of it. <a href="./start/">Getting started</a> shows both ways.</li> <li><strong>No server sync yet.</strong> Tabs of one browser stay in step today. The seam for a server is two
small interfaces, and nothing on the server side is written.</li></ul> <h2>tldraw</h2> <p>The architecture follows the ideas of <a href="https://tldraw.dev" rel="nofollow">tldraw</a>: records in a reactive store,
one class per kind of shape, tools as state machines, plugins as lists of classes. Draw is an
independent implementation, written from scratch for Svelte, and contains no tldraw source code,
icons or assets. tldraw is a trademark of tldraw Inc.; this project is not affiliated with or
endorsed by it. <a href="./features/">What is built</a> uses tldraw’s feature set as the yardstick, because
it is the most complete whiteboard SDK there is.</p> <h2>Licence</h2> <p><a href="https://github.com/klementine-net/svelte-draw/blob/main/LICENSE" rel="nofollow">MIT</a>. Use it, change it, ship it;
keep the copyright notice.</p>`,1);function s(e,s){let c=i(s,[`children`,`$$slots`,`$$events`,`$$legacy`]);a(e,r(()=>c,{children:(e,r)=>{var i=o();t(24),n(e,i)},$$slots:{default:!0}}))}export{s as component};