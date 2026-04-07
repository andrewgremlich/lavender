<script lang="ts" module>
	import {
		ChevronDown,
		Circle,
		CircleCheck,
		CircleDot,
		CirclePlus,
		Droplet,
		Droplets,
		Egg,
		House,
		Info,
		type IconNode,
		LogOut,
		Menu,
		Minus,
		Pencil,
		Save,
		Settings,
		Trash2,
		TrendingUp
	} from 'lucide';

	const ICONS: Record<string, IconNode> = {
		'chevron-down': ChevronDown,
		circle: Circle,
		'circle-check': CircleCheck,
		'circle-dot': CircleDot,
		'circle-plus': CirclePlus,
		droplet: Droplet,
		droplets: Droplets,
		egg: Egg,
		house: House,
		info: Info,
		'log-out': LogOut,
		menu: Menu,
		minus: Minus,
		pencil: Pencil,
		save: Save,
		settings: Settings,
		'trash-2': Trash2,
		'trending-up': TrendingUp
	};

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	type Props = {
		name: string;
		size?: number;
		strokeWidth?: number;
	};

	let { name, size = 20, strokeWidth = 2 }: Props = $props();

	// Each Lucide IconNode is ['svg', attrs, children]. We splat the children
	// (each a [tagName, attrs] tuple) into inline SVG elements.
	const node = $derived(ICONS[name]);
	const children = $derived(
		(node?.[2] ?? []) as unknown as Array<[string, Record<string, string>]>
	);
</script>

{#if node}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#each children as [tag, attrs] (tag + JSON.stringify(attrs))}
			{#if tag === 'path'}
				<path {...attrs} />
			{:else if tag === 'circle'}
				<circle {...attrs} />
			{:else if tag === 'line'}
				<line {...attrs} />
			{:else if tag === 'rect'}
				<rect {...attrs} />
			{:else if tag === 'polyline'}
				<polyline {...attrs} />
			{:else if tag === 'polygon'}
				<polygon {...attrs} />
			{:else if tag === 'ellipse'}
				<ellipse {...attrs} />
			{/if}
		{/each}
	</svg>
{/if}
