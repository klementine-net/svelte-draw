<script lang="ts">
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@klementine/ui/dropdown-menu';
	import { Input } from '@klementine/ui/input';
	import { Toolbar, ToolbarButton } from '@klementine/ui/toolbar';
	import type { Editor } from '@simon-lund/svelte-draw';
	import { download, openFile, saveFile, toPng } from '@simon-lund/svelte-draw/svelte';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * PageMenu: the page being looked at, and the menu to go to another, add one, rename or
	 * delete this one. Renaming turns the button into a field; Enter keeps the name, Escape
	 * drops it.
	 *
	 * @example
	 * <PageMenu {editor} />
	 */
	let {
		editor,
		labels = defaultLabels,
		class: className
	}: { editor: Editor; labels?: DrawLabels; class?: string } = $props();

	const words = $derived(labels.pages);
	const pages = $derived(editor.getPages());
	const page = $derived(editor.getPage());
	const locked = $derived(editor.readOnly.get());

	let bar = $state<HTMLElement | null>(null);

	async function savePicture() {
		// The picture is of the selection when there is one, of the page otherwise.
		const ids = editor.selection.peek();
		const canvas = bar?.closest('.kd-root');
		const png = canvas && (await toPng(editor, canvas, ids.length > 0 ? { ids } : {}));
		if (png) download(png, `${page?.name ?? 'drawing'}.png`);
	}

	let renaming = $state(false);
	let name = $state('');

	let field = $state<HTMLInputElement | null>(null);

	function startRenaming() {
		name = page?.name ?? '';
		renaming = true;
		// After the menu has closed and handed the focus back: then the field takes it.
		setTimeout(() => {
			field?.focus();
			field?.select();
		}, 60);
	}
	function keep() {
		if (renaming && page) editor.renamePage(page.id, name);
		renaming = false;
	}
</script>

<Toolbar bind:ref={bar} aria-label={words.label} class={['shadow-float', className]}>
	{#if renaming}
		<Input
			aria-label={words.rename}
			class="h-8 w-40"
			bind:ref={field}
			bind:value={name}
			onblur={keep}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key === 'Enter') keep();
				else if (event.key === 'Escape') renaming = false;
				// The canvas's shortcuts are not for a name being typed.
				event.stopPropagation();
			}}
		/>
	{:else}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<ToolbarButton {...props} aria-label="{words.label}: {page?.name ?? ''}">
						<span class="max-w-40 truncate">{page?.name ?? ''}</span>
						<CaretDown aria-hidden="true" class="size-3" />
					</ToolbarButton>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="start">
				<DropdownMenuRadioGroup value={page?.id ?? ''} onValueChange={(id) => editor.setPage(id)}>
					{#each pages as each (each.id)}
						<DropdownMenuRadioItem value={each.id}>{each.name}</DropdownMenuRadioItem>
					{/each}
				</DropdownMenuRadioGroup>
				{#if !locked}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => editor.createPage(words.name(pages.length + 1))}>
						{words.add}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={startRenaming}>{words.rename}</DropdownMenuItem>
					<DropdownMenuItem
						disabled={pages.length < 2}
						onSelect={() => page && editor.deletePage(page.id)}
					>
						{words.delete}
					</DropdownMenuItem>
				{/if}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={savePicture}>{labels.file.picture}</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => saveFile(editor, page?.name)}>
					{labels.file.save}
				</DropdownMenuItem>
				{#if !locked}
					<DropdownMenuItem onSelect={() => openFile(editor)}>{labels.file.open}</DropdownMenuItem>
				{/if}
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}
</Toolbar>
