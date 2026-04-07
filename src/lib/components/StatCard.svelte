<script lang="ts">
	type Props = {
		value: string | number;
		label: string;
		warning?: boolean;
	};

	let { value, label, warning = false }: Props = $props();
</script>

<div class="stat">
	<div class="value" class:warning>{value}</div>
	<div class="label">{label}</div>
</div>

<style>
	.stat {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		text-align: center;
	}

	.value {
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--color-primary);
	}

	.value.warning {
		color: var(--color-warning);
	}

	.label {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		margin-top: var(--space-xs);
	}
</style>
