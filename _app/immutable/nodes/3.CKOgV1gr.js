import{Lt as e,Q as t,X as n,w as r,x as i,xt as a,yt as o}from"../chunks/DSvo80yW.js";import"../chunks/DRHcftYe.js";import{t as s}from"../chunks/B9Igg3Fh.js";import{t as c}from"../chunks/9FSjduFE.js";var l=t(`<p>svelte-draw is an infinite canvas for Svelte: the engine of a whiteboard, and the parts to
put one on a page. You draw, write, drag out shapes, connect them with arrows that stay
attached, add pictures and links, group and frame things, turn and snap them, copy and paste,
undo, on as many pages as you like. A board can be kept in the browser, where every open tab
shows the same board; it saves to a file and to a picture.</p> <p>Shapes and tools are plugins, also the ones that come with it. So the same engine can be a
whiteboard today and a design tool later, and a kind of shape your app needs is a class and a
Svelte component, not a fork.</p> <!> <h2>What it is made of</h2> <p>Two layers, structured like the <a href="https://tanstack.com" rel="nofollow">TanStack</a> libraries: a core in plain
TypeScript that knows no framework, and a Svelte layer on top. A Svelte app imports one thing,
and the core also comes on its own:</p> <table><thead><tr><th>Import</th><th>What it is</th></tr></thead><tbody><tr><td><code>@klementine/svelte-draw</code></td><td>everything for a Svelte app: the canvas, the views of the built-in shapes, the minimap, and the whole engine</td></tr><tr><td><code>@klementine/svelte-draw/core</code></td><td>the engine alone: plain TypeScript with no UI framework, so it runs in a test and on a server as in a browser</td></tr></tbody></table> <p><a href="./concepts/">How it is built</a> explains the engine in five ideas.</p> <h2>Where it stands</h2> <ul><li><strong>Tested where it counts, not everywhere.</strong> The engine has its own tests, which need no
browser, and the Svelte layer is tested in Chrome. Some parts have only been tried in a
browser, and a few never ran at all. <a href="./features/">What is built</a> says which is which, line by
line.</li> <li><strong>Built with AI.</strong> The code, the tests and these pages are written by AI coding agents
(Claude Code), directed by the project’s maintainers. The pages are not finished: not all of
them have been reviewed by a person yet.</li> <li><strong>The UI is yours.</strong> The library provides the engine and the canvas, in plain CSS, with
three small dependencies. The toolbar, the panels and the menus you build in your own design:
on the editor, or by adapting the ones in the whiteboard example. <a href="./start/">Getting started</a> shows both.</li> <li><strong>No server sync yet.</strong> A board open in several tabs of one browser updates in all of them.
Syncing through a server is prepared by two small interfaces, and nothing on the server side is
written.</li></ul> <h2>Credits</h2> <p>Draw’s architecture is inspired by <a href="https://tldraw.dev" rel="nofollow">tldraw</a>: records in a reactive store,
one class per kind of shape, tools as state machines. Draw is an independent project, written
from scratch for Svelte; it contains no tldraw code and is not affiliated with tldraw Inc.</p> <p>Ink strokes are drawn with <a href="https://github.com/steveruizok/perfect-freehand" rel="nofollow">perfect-freehand</a>,
the stacking order comes from <a href="https://github.com/rocicorp/fractional-indexing" rel="nofollow">fractional-indexing</a>, and the icons are <a href="https://phosphoricons.com" rel="nofollow">Phosphor</a>.</p> <h2>Licence</h2> <p><a href="https://github.com/klementine-net/svelte-draw/blob/main/LICENSE" rel="nofollow">MIT</a>. Use it, change it, ship it;
keep the copyright notice.</p>`,1);function u(t,u){let d=i(u,[`children`,`$$slots`,`$$events`,`$$legacy`]);s(t,r(()=>d,{children:(t,r)=>{var i=l(),s=a(o(i),4);c(s,{}),e(22),n(t,i)},$$slots:{default:!0}}))}export{u as component};