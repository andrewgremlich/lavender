import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('renders an SVG for a known icon name', () => {
		const { container } = render(Icon, { props: { name: 'house' } });
		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
	});

	it('renders nothing for an unknown icon name', () => {
		const { container } = render(Icon, { props: { name: 'nonexistent-icon' } });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeInTheDocument();
	});

	it('passes size prop to the SVG', () => {
		const { container } = render(Icon, { props: { name: 'house', size: 32 } });
		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
		expect(svg!.getAttribute('width')).toBe('32');
		expect(svg!.getAttribute('height')).toBe('32');
	});
});
