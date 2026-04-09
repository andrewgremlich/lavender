<script lang="ts">
	import { goto } from '$app/navigation';
	import { entriesStore } from '$lib/client/entries.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Input from '$lib/components/Input.svelte';
	import PillGroup from '$lib/components/PillGroup.svelte';
	import PillOption from '$lib/components/PillOption.svelte';
	import Text from '$lib/components/Text.svelte';
	import type { HealthEntryData } from '$lib/types';
	import { INDICATORS } from '$lib/utils/indicators';
	import { celsiusToFahrenheit, fahrenheitToCelsius, getUnitSystem } from '$lib/utils/units';
	import { _ } from 'svelte-i18n';

	type TempUnit = 'C' | 'F';
	type Form = {
		date: string;
		bbt: string;
		cervicalMucus: string;
		lhSurge: string;
		bleedingStatus: 'none' | 'started' | 'ended';
		bleedingFlow: string;
		notes: string;
		indicators: Record<string, boolean>;
	};

	const MUCUS_OPTIONS = $derived([
		{ value: 'dry', icon: 'circle', label: $_('entry.mucus.dry') },
		{ value: 'sticky', icon: 'circle-dot', label: $_('entry.mucus.sticky') },
		{ value: 'creamy', icon: 'droplet', label: $_('entry.mucus.creamy') },
		{ value: 'watery', icon: 'droplets', label: $_('entry.mucus.watery') },
		{ value: 'eggWhite', icon: 'egg', label: $_('entry.mucus.eggWhite') }
	] as const);

	const LH_OPTIONS = $derived([
		{ value: '0', icon: 'circle', label: $_('entry.lh.none') },
		{ value: '1', icon: 'circle-dot', label: $_('entry.lh.light') },
		{ value: '2', icon: 'circle-check', label: $_('entry.lh.positive') }
	] as const);

	const FLOW_OPTIONS = $derived([
		{ value: 'light', icon: 'minus', label: $_('entry.flow.light') },
		{ value: 'medium', icon: 'droplet', label: $_('entry.flow.medium') },
		{ value: 'heavy', icon: 'droplets', label: $_('entry.flow.heavy') }
	] as const);

	const today = new Date().toISOString().split('T')[0];

	function blankForm(): Form {
		return {
			date: today,
			bbt: '',
			cervicalMucus: '',
			lhSurge: '',
			bleedingStatus: 'none',
			bleedingFlow: '',
			notes: '',
			indicators: Object.fromEntries(INDICATORS.map((i) => [i.key, false]))
		};
	}

	let tempUnit = $state<TempUnit>(getUnitSystem() === 'us' ? 'F' : 'C');
	let editId = $state<string | null>(null);
	let form = $state<Form>(blankForm());
	let error = $state<string | null>(null);
	let saved = $state(false);
	let submitting = $state(false);

	// If there's already an entry for the selected date (and we're not editing it),
	// prompt the user to edit that entry instead of creating a duplicate.
	const existingForDate = $derived(
		!editId ? entriesStore.entryForDate(form.date) : null
	);

	$effect(() => {
		const raw = sessionStorage.getItem('lavender_edit_entry');
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as HealthEntryData & { id?: string };
			editId = parsed.id ?? null;
			const next = blankForm();
			if (parsed.date) next.date = parsed.date;
			if (parsed.basalBodyTemp != null) {
				const temp =
					tempUnit === 'F' ? celsiusToFahrenheit(parsed.basalBodyTemp) : parsed.basalBodyTemp;
				next.bbt = (Math.round(temp * 100) / 100).toString();
			}
			if (parsed.cervicalMucus) next.cervicalMucus = parsed.cervicalMucus;
			if (parsed.lhSurge != null) next.lhSurge = String(parsed.lhSurge);
			if (parsed.bleedingStart) next.bleedingStatus = 'started';
			else if (parsed.bleedingEnd) next.bleedingStatus = 'ended';
			if (parsed.bleedingFlow) next.bleedingFlow = parsed.bleedingFlow;
			if (parsed.notes) next.notes = parsed.notes;
			for (const ind of INDICATORS) {
				if ((parsed as unknown as Record<string, unknown>)[ind.key]) {
					next.indicators[ind.key] = true;
				}
			}
			form = next;
		} catch {
			// ignore corrupt edit data
		}
		return () => sessionStorage.removeItem('lavender_edit_entry');
	});

	function switchUnit(next: TempUnit) {
		if (next === tempUnit) return;
		const current = Number.parseFloat(form.bbt);
		tempUnit = next;
		if (!Number.isNaN(current)) {
			const converted = next === 'F' ? celsiusToFahrenheit(current) : fahrenheitToCelsius(current);
			form.bbt = (Math.round(converted * 100) / 100).toString();
		}
	}

	function buildEntry(): HealthEntryData {
		const entry: HealthEntryData = { date: form.date };
		if (form.bbt) {
			let tempC = Number.parseFloat(form.bbt);
			if (tempUnit === 'F') tempC = Math.round(fahrenheitToCelsius(tempC) * 100) / 100;
			entry.basalBodyTemp = tempC;
		}
		if (form.cervicalMucus)
			entry.cervicalMucus = form.cervicalMucus as HealthEntryData['cervicalMucus'];
		if (form.lhSurge) {
			const lhValue = Number.parseInt(form.lhSurge, 10) as HealthEntryData['lhSurge'];
			if (lhValue) entry.lhSurge = lhValue;
		}
		for (const ind of INDICATORS) {
			if (form.indicators[ind.key]) (entry as unknown as Record<string, unknown>)[ind.key] = true;
		}
		if (form.bleedingStatus === 'started') entry.bleedingStart = true;
		if (form.bleedingStatus === 'ended') entry.bleedingEnd = true;
		if (form.bleedingFlow)
			entry.bleedingFlow = form.bleedingFlow as HealthEntryData['bleedingFlow'];
		if (form.notes.trim()) entry.notes = form.notes.trim();
		return entry;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!form.date) {
			error = $_('entry.selectDateError');
			return;
		}

		submitting = true;
		try {
			await entriesStore.saveEntry(buildEntry(), editId);
			saved = true;
			if (editId) editId = null;
		} catch (err) {
			error = err instanceof Error ? err.message : $_('entry.saveError');
		} finally {
			submitting = false;
		}
	}

	function addAnother() {
		form = blankForm();
		saved = false;
	}

	const tempPlaceholder = $derived(tempUnit === 'C' ? '36.50' : '97.70');
	const tempMin = $derived(tempUnit === 'C' ? '35' : '95');
	const tempMax = $derived(tempUnit === 'C' ? '42' : '107.6');
</script>

<svelte:head>
	<title>{$_('entry.pageTitle')}</title>
</svelte:head>

<Text as="h2">{editId ? $_('entry.editTitle') : $_('entry.title')}</Text>

<div class="card">
	{#if error}
		<div class="msg error">{error}</div>
	{/if}

	{#if saved}
		<div class="msg success">
			{editId ? $_('entry.updatedSuccess') : $_('entry.savedSuccess')}
			<div class="success-actions">
				{#if !editId}
					<Button type="button" onclick={addAnother}>{$_('entry.addAnother')}</Button>
				{/if}
				<Button type="button" onclick={() => goto('/app')}>{$_('entry.viewChart')}</Button>
			</div>
		</div>
	{:else if existingForDate}
		<div class="msg warning">
			You already have an entry for {form.date}. Would you like to edit it instead?
			<div class="success-actions">
				<Button
					type="button"
					onclick={() => {
						sessionStorage.setItem(
							'lavender_edit_entry',
							JSON.stringify({ ...existingForDate })
						);
						location.reload();
					}}
				>
					Edit existing entry
				</Button>
			</div>
		</div>
	{:else}
		<form onsubmit={handleSubmit}>
			<Input label={$_('entry.date')} id="entry-date" type="date" bind:value={form.date} required />

			<details open>
				<summary>{$_('entry.temperature')}</summary>
				<div class="temp-header">
					<label for="bbt">{$_('entry.bbt', { values: { unit: tempUnit } })}</label>
					<div class="unit-toggle">
						<button type="button" class:active={tempUnit === 'C'} onclick={() => switchUnit('C')}
							>°C</button
						>
						<button type="button" class:active={tempUnit === 'F'} onclick={() => switchUnit('F')}
							>°F</button
						>
					</div>
				</div>
				<input
					id="bbt"
					type="number"
					step="0.01"
					min={tempMin}
					max={tempMax}
					placeholder={tempPlaceholder}
					bind:value={form.bbt}
				/>
			</details>

			<details>
				<summary>{$_('entry.cervicalMucus')}</summary>
				<PillGroup>
					{#each MUCUS_OPTIONS as opt (opt.value)}
						<PillOption>
							<input
								type="radio"
								name="cervicalMucus"
								value={opt.value}
								bind:group={form.cervicalMucus}
							/>
							<span><Icon name={opt.icon} /> {opt.label}</span>
						</PillOption>
					{/each}
				</PillGroup>
			</details>

			<details>
				<summary>{$_('entry.lhSurge')}</summary>
				<PillGroup>
					{#each LH_OPTIONS as opt (opt.value)}
						<PillOption>
							<input type="radio" name="lhSurge" value={opt.value} bind:group={form.lhSurge} />
							<span><Icon name={opt.icon} /> {opt.label}</span>
						</PillOption>
					{/each}
				</PillGroup>
			</details>

			<details>
				<summary>{$_('entry.indicators')}</summary>
				<PillGroup>
					{#each INDICATORS as ind (ind.key)}
						<PillOption>
							<input type="checkbox" bind:checked={form.indicators[ind.key]} />
							<span>{$_(`indicators.${ind.key}`)}</span>
						</PillOption>
					{/each}
				</PillGroup>
			</details>

			<details>
				<summary>{$_('entry.periodBleeding')}</summary>
				<PillGroup row>
					<PillOption>
						<input
							type="radio"
							name="bleedingStatus"
							value="none"
							bind:group={form.bleedingStatus}
						/>
						<span><Icon name="minus" /> {$_('entry.bleeding.none')}</span>
					</PillOption>
					<PillOption>
						<input
							type="radio"
							name="bleedingStatus"
							value="started"
							bind:group={form.bleedingStatus}
						/>
						<span><Icon name="circle-plus" /> {$_('entry.bleeding.started')}</span>
					</PillOption>
					<PillOption>
						<input
							type="radio"
							name="bleedingStatus"
							value="ended"
							bind:group={form.bleedingStatus}
						/>
						<span><Icon name="circle-check" /> {$_('entry.bleeding.ended')}</span>
					</PillOption>
				</PillGroup>
				<label for="flow-section">{$_('entry.flowIntensity')}</label>
				<PillGroup>
					{#each FLOW_OPTIONS as opt (opt.value)}
						<PillOption>
							<input
								type="radio"
								name="bleedingFlow"
								value={opt.value}
								bind:group={form.bleedingFlow}
							/>
							<span><Icon name={opt.icon} /> {opt.label}</span>
						</PillOption>
					{/each}
				</PillGroup>
			</details>

			<details>
				<summary>{$_('entry.notes')}</summary>
				<textarea placeholder={$_('entry.notesPlaceholder')} bind:value={form.notes} rows="4"
				></textarea>
			</details>

			<Button type="submit" size="lg" disabled={submitting}>
				<Icon name="save" />
				{submitting ? $_('entry.saving') : editId ? $_('entry.update') : $_('entry.save')}
			</Button>
		</form>
	{/if}
</div>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
	}

	.msg {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.msg.error {
		background: var(--color-error-bg);
		color: var(--color-error);
		border: 1px solid var(--color-error);
	}

	.msg.warning {
		background: var(--color-warning-bg, #fef9c3);
		color: var(--color-warning, #854d0e);
		border: 1px solid var(--color-warning, #854d0e);
	}

	.msg.success {
		background: var(--color-success-bg);
		color: var(--color-success);
		border: 1px solid var(--color-success);
	}

	.success-actions {
		margin-top: var(--space-sm);
		display: flex;
		gap: var(--space-sm);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	input[type='number'],
	textarea {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		border-radius: var(--radius-md);
		font-size: var(--text-base);
		width: 100%;
		color-scheme: light dark;
	}

	input[type='number']:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-border-focus);
		box-shadow: 0 0 0 3px var(--color-primary-alpha);
	}

	textarea {
		resize: vertical;
		min-height: 80px;
	}

	details {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}

	details[open] {
		padding-bottom: var(--space-md);
	}

	summary {
		font-weight: 500;
		cursor: pointer;
		padding: var(--space-xs) 0;
	}

	.temp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		margin-top: var(--space-sm);
	}

	.unit-toggle {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.unit-toggle button {
		padding: var(--space-xs) var(--space-md);
		border: none;
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--text-sm);
	}

	.unit-toggle button.active {
		background: var(--color-primary);
		color: var(--color-text-inverse);
	}
</style>
