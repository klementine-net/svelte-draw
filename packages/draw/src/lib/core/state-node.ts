/*
 * Tools are state machines, and the machines nest: the root holds the tools, a tool holds its
 * states (`select` → `idle`, `translating`, …). An event enters at the root and walks down the
 * active path, so each state only says what it does with an event while it is the active one.
 *
 * A new tool is a subclass with its states as children, registered through a plugin.
 */

import { atom } from './signal.ts';
import type { Editor } from './editor.ts';
import type { CancelInfo, DrawEvent, KeyInfo, PointerInfo } from './events.ts';

export interface StateNodeConstructor {
	new (editor: Editor, parent?: StateNode): StateNode;
	id: string;
	initial?: string;
	children?: () => StateNodeConstructor[];
}

export abstract class StateNode {
	/** The name of this state among its siblings (a tool's id is what `setTool` takes). */
	static id: string;
	/** The child that becomes active when this state is entered. */
	static initial?: string;
	static children?: () => StateNodeConstructor[];

	readonly editor: Editor;
	readonly parent?: StateNode;
	readonly children = new Map<string, StateNode>();
	/** The active child, if this state has children and is active. */
	readonly current = atom<StateNode | undefined>(undefined);
	isActive = false;

	constructor(editor: Editor, parent?: StateNode) {
		this.editor = editor;
		this.parent = parent;
		for (const Child of this.#ctor.children?.() ?? []) this.addChild(Child);
	}

	get #ctor() {
		return this.constructor as StateNodeConstructor;
	}

	get id(): string {
		return this.#ctor.id;
	}

	addChild(Child: StateNodeConstructor) {
		if (this.children.has(Child.id)) throw new Error(`State "${Child.id}" is registered twice`);
		this.children.set(Child.id, new Child(this.editor, this));
	}

	/** The active path below this state, like `select.translating`. */
	path(): string {
		const child = this.current.peek();
		return child ? `${child.id}.${child.path()}`.replace(/\.$/, '') : '';
	}

	/**
	 * Makes the child `path` the active one (`idle`, or deeper: `select.resizing`). `info` goes
	 * to the `onEnter` of the last state on the path.
	 */
	transition(path: string, info?: unknown) {
		const [id, ...rest] = path.split('.');
		const next = this.children.get(id);
		if (!next) throw new Error(`"${this.id}" has no state "${id}"`);
		const previous = this.current.peek();
		if (previous !== next || rest.length === 0) {
			previous?.exit();
			this.current.set(next);
			next.enter(rest.length === 0 ? info : undefined);
		}
		if (rest.length > 0) next.transition(rest.join('.'), info);
		this.editor.toolPath.set(this.editor.root.path());
	}

	enter(info: unknown) {
		this.isActive = true;
		this.onEnter?.(info);
		const initial = this.#ctor.initial;
		if (initial && this.isActive && !this.current.peek()) this.transition(initial);
	}

	exit() {
		this.current.peek()?.exit();
		this.current.set(undefined);
		this.isActive = false;
		this.onExit?.();
	}

	/** Runs this state's handler, then the active child's (unless the handler moved on). */
	handleEvent(event: DrawEvent) {
		const child = this.current.peek();
		switch (event.type) {
			case 'pointer':
				if (event.name === 'down') this.onPointerDown?.(event);
				else if (event.name === 'move') this.onPointerMove?.(event);
				else this.onPointerUp?.(event);
				break;
			case 'key':
				if (event.name === 'down') this.onKeyDown?.(event);
				else this.onKeyUp?.(event);
				break;
			case 'double_click':
				this.onDoubleClick?.(event);
				break;
			case 'cancel':
				this.onCancel?.(event);
				break;
		}
		if (child && this.isActive && this.current.peek() === child) child.handleEvent(event);
	}

	onEnter?(info: unknown): void;
	onExit?(): void;
	onPointerDown?(event: PointerInfo): void;
	onPointerMove?(event: PointerInfo): void;
	onPointerUp?(event: PointerInfo): void;
	onDoubleClick?(event: PointerInfo): void;
	onKeyDown?(event: KeyInfo): void;
	onKeyUp?(event: KeyInfo): void;
	/** Escape, or the browser took the pointer away: drop what is in progress. */
	onCancel?(event: CancelInfo): void;
}
