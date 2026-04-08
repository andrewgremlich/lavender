<script lang="ts">
	type Size = 'sm' | 'md' | 'lg' | 'xl';

	type Props = {
		size?: Size;
		alt?: string;
		class?: string;
	};

	let { size = 'md', alt = 'Lavender logo', class: className = '' }: Props = $props();

	const sources: Record<Size, string> = {
		sm: '/logo-64x64.png',
		md: '/logo-128x128.png',
		lg: '/logo-310x310.png',
		xl: '/logo-512x512.png'
	};
</script>

<img src={sources[size]} {alt} class="logo logo-{size} {className}" />

<style>
	.logo {
		display: block;
		object-fit: contain;
	}
	.logo-sm {
		width: 2rem;
		height: 2rem;
	}
	.logo-md {
		width: 4rem;
		height: 4rem;
	}
	.logo-lg {
		width: 8rem;
		height: 8rem;
	}
	.logo-xl {
		width: 12rem;
		height: 12rem;
	}
</style>
