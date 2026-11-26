<script lang="ts">
	import Warning from 'phosphor-svelte/lib/Warning';
	import { href } from '#lib/nav.ts';

	/**
	 * EarlyNotice: the site's one warning, on the pages people arrive at and install from: Draw
	 * is in early development. Ink on paper like the rest (DESIGN.md): the sign and the outline
	 * say that it is a warning, no colour does.
	 */
</script>

<aside class="notice" aria-labelledby="early-notice">
	<Warning aria-hidden="true" weight="fill" class="sign" />
	<div>
		<p id="early-notice" class="title">Early development</p>
		<p>
			Draw works, and it is young. Its API will change between releases without notice, and parts of
			it are little tested. Pin the version you install, and check
			<a href={href('/docs/features/')}>what is built</a> before you rely on a part of it.
		</p>
	</div>
</aside>

<style>
	.notice {
		display: flex;
		gap: 0.75rem;
		max-width: var(--site-column);
		padding: 0.875rem 1rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--ink);
	}
	/* The sign sits on the title's line. */
	.notice :global(.sign) {
		flex: none;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.1875rem;
	}
	.title {
		font-weight: 600;
	}
	p + p {
		margin-top: 0.125rem;
		color: var(--ink2);
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		text-decoration-color: var(--line-strong);
	}
	a:hover {
		text-decoration-color: currentColor;
	}
</style>
