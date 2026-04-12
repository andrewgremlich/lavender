<script lang="ts" module>
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Droplet from '@lucide/svelte/icons/droplet';
	import Droplets from '@lucide/svelte/icons/droplets';
	import Egg from '@lucide/svelte/icons/egg';
	import Heart from '@lucide/svelte/icons/heart';
	import House from '@lucide/svelte/icons/house';
	import Info from '@lucide/svelte/icons/info';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import Minus from '@lucide/svelte/icons/minus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Save from '@lucide/svelte/icons/save';
	import Settings from '@lucide/svelte/icons/settings';
	import Shield from '@lucide/svelte/icons/shield';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import type { Component } from 'svelte';

	const ICONS: Record<string, Component<{ size?: number; strokeWidth?: number }>> = {
		'chevron-down': ChevronDown,
		circle: Circle,
		'circle-check': CircleCheck,
		'circle-dot': CircleDot,
		'circle-plus': CirclePlus,
		droplet: Droplet,
		droplets: Droplets,
		egg: Egg,
		heart: Heart,
		house: House,
		info: Info,
		'log-out': LogOut,
		menu: Menu,
		minus: Minus,
		pencil: Pencil,
		save: Save,
		settings: Settings,
		shield: Shield,
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

	const icon = $derived(ICONS[name]);
</script>

{#if icon}
	{@const IconComponent = icon}
	<IconComponent {size} {strokeWidth} />
{/if}
