<script lang="ts">
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { DropdownMenu, Toolbar } from 'bits-ui';
	import type { Editor } from '@simon-lund/svelte-draw';
	import { download, openFile, saveFile, toPng } from '@simon-lund/svelte-draw/svelte';
	import { defaultLabels, type DrawLabels } from './labels';
	import { toCanvas, useScheme } from './board';

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

	const scheme = useScheme();
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

<Toolbar.Root
	bind:ref={bar}
	aria-label={words.label}
	class={['wb wb-bar', className]}
	data-scheme={scheme()}
>
	{#if renaming}
		<input
			aria-label={words.rename}
			class="wb-field"
			bind:this={field}
			bind:value={name}
			onblur={keep}
			onkeydown={(event) => {
				if (event.key === 'Enter') keep();
				else if (event.key === 'Escape') renaming = false;
				// The canvas's shortcuts are not for a name being typed.
				event.stopPropagation();
			}}
		/>
	{:else}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Toolbar.Button
						{...props}
						class="wb-item wb-text"
						aria-label="{words.label}: {page?.name ?? ''}"
					>
						<span class="wb-name">{page?.name ?? ''}</span>
						<CaretDown aria-hidden="true" />
					</Toolbar.Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					side="bottom"
					align="start"
					sideOffset={6}
					collisionPadding={8}
					class="wb wb-menu"
					data-scheme={scheme()}
					onCloseAutoFocus={(event) => toCanvas(event, bar)}
				>
					<DropdownMenu.RadioGroup
						value={page?.id ?? ''}
						onValueChange={(id) => editor.setPage(id)}
					>
						{#each pages as each (each.id)}
							<DropdownMenu.RadioItem value={each.id} class="wb-menu-item wb-marked">
								{#snippet children({ checked })}
									<span class="wb-mark" aria-hidden="true">
										{#if checked}<span class="wb-dot"></span>{/if}
									</span>
									{each.name}
								{/snippet}
							</DropdownMenu.RadioItem>
						{/each}
					</DropdownMenu.RadioGroup>
					{#if !locked}
						<DropdownMenu.Separator class="wb-menu-rule" />
						<DropdownMenu.Item
							class="wb-menu-item"
							onSelect={() => editor.createPage(words.name(pages.length + 1))}
						>
							{words.add}
						</DropdownMenu.Item>
						<DropdownMenu.Item class="wb-menu-item" onSelect={startRenaming}>
							{words.rename}
						</DropdownMenu.Item>
						<DropdownMenu.Item
							class="wb-menu-item"
							disabled={pages.length < 2}
							onSelect={() => page && editor.deletePage(page.id)}
						>
							{words.delete}
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Separator class="wb-menu-rule" />
					<DropdownMenu.Item class="wb-menu-item" onSelect={savePicture}>
						{labels.file.picture}
					</DropdownMenu.Item>
					<DropdownMenu.Item class="wb-menu-item" onSelect={() => saveFile(editor, page?.name)}>
						{labels.file.save}
					</DropdownMenu.Item>
					{#if !locked}
						<DropdownMenu.Item class="wb-menu-item" onSelect={() => openFile(editor)}>
							{labels.file.open}
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	{/if}
</Toolbar.Root>
