<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { _ } from 'svelte-i18n';

	let { data } = $props();

	$effect(() => {
		if (auth.loggedIn) goto('/app', { replaceState: true });
	});

	let tryingDemo = $state(false);
	let demoError = $state<string | null>(null);

	async function handleDemoLogin() {
		tryingDemo = true;
		demoError = null;
		try {
			await auth.demoLogin();
			await goto('/app', { replaceState: true });
		} catch (e) {
			demoError = e instanceof Error ? e.message : $_('home.demoError');
		} finally {
			tryingDemo = false;
		}
	}

	const ogDescription = $derived(
		data.spotsRemaining > 0
			? $_('home.ogDescriptionWithSpots', { values: { count: data.spotsRemaining } })
			: $_('home.ogDescriptionFull'),
	);

	const jsonLd = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Lavender',
		url: data.origin,
		description:
			'A privacy-first fertility tracker with end-to-end encryption. All health data is encrypted on your device before reaching the server.',
		applicationCategory: 'HealthApplication',
		operatingSystem: 'Web',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
			description: 'Free cross-device sync for the first 25 users',
		},
		featureList: [
			'AES-256-GCM end-to-end encryption',
			'PBKDF2 key derivation — key never leaves device',
			'No third-party analytics',
			'Configurable data retention (6–12 months)',
			'Offline-capable PWA',
			'Recovery code for password change without data loss',
		],
	}));
</script>

<svelte:head>
	<title>{$_('home.pageTitle')}</title>
	<meta name="description" content={$_('home.metaDescription')} />
	<link rel="canonical" href="{data.origin}/" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Lavender" />
	<meta property="og:title" content={$_('home.ogTitle')} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:url" content="{data.origin}/" />
	<meta property="og:image" content="{data.origin}/og" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content={$_('home.ogImageAlt', { values: { count: data.spotsRemaining } })}
	/>

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={$_('home.twitterTitle')} />
	<meta name="twitter:description" content={$_('home.twitterDescription')} />
	<meta name="twitter:image" content="{data.origin}/og" />

	<!-- JSON-LD structured data -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${jsonLd}<` + `/script>`}
</svelte:head>

<main>
	<Logo size="xl" class="hero-logo" />
	<Text as="h1">Lavender</Text>
	<p class="app-claim">{$_('home.appClaim')}</p>
	<Text variant="muted">{$_('home.tagline')}</Text>
	<p class="tagline-subhead">{$_('home.taglineSubhead')}</p>
	<div class="cta-group">
		<a href="/auth/login" class="cta">{$_('home.signIn')}</a>
		<button class="cta-secondary" onclick={handleDemoLogin} disabled={tryingDemo}>
			{tryingDemo ? $_('home.starting') : $_('home.tryItOut')}
		</button>
	</div>
	{#if demoError}
		<Text variant="error">{demoError}</Text>
	{/if}
	<div class="trust-bar">
		<span class="trust-item"><Icon name="shield" size={14} />{$_('home.trust.encryption')}</span>
		<span class="trust-item"><Icon name="shield-off" size={14} />{$_('home.trust.noAnalytics')}</span>
		<span class="trust-item"><a href="/info"><Icon name="info" size={14} />{$_('home.trust.openMethodology')}</a></span>
		<span class="trust-item"><Icon name="trending-up" size={14} />{$_('home.trust.offline')}</span>
		<span class="trust-item"><Icon name="trash-2" size={14} />{$_('home.trust.autoDelete')}</span>
	</div>
</main>

<div class="marketing">
	<!-- Who Is This For -->
	<section id="use-cases" class="marketing-section">
		<h2 class="section-title">{$_('home.useCases.title')}</h2>
		<div class="cards">
			<div class="card">
				<div class="card-icon" aria-hidden="true">🌱</div>
				<h3>{$_('home.useCases.ttc.title')}</h3>
				<p>{$_('home.useCases.ttc.body')}</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">📐</div>
				<h3>{$_('home.useCases.fam.title')}</h3>
				<p>{$_('home.useCases.fam.body')}</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">📈</div>
				<h3>{$_('home.useCases.awareness.title')}</h3>
				<p>{$_('home.useCases.awareness.body')}</p>
			</div>
		</div>
	</section>

	<!-- What You Track -->
	<section id="what-you-track" class="marketing-section alt">
		<h2 class="section-title">{$_('home.tracking.title')}</h2>
		<p class="section-lead">{$_('home.tracking.lead')}</p>
		<div class="tracking-groups">
			<div class="tracking-group">
				<h3 class="tracking-group-title">{$_('home.tracking.group.cycle')}</h3>
				<div class="tracking-pills">
					<span class="pill">{$_('entry.periodBleeding')}</span>
					<span class="pill">{$_('entry.bleeding.started')}</span>
					<span class="pill">{$_('entry.bleeding.ended')}</span>
					<span class="pill">{$_('entry.flowIntensity')}</span>
				</div>
			</div>
			<div class="tracking-group">
				<h3 class="tracking-group-title">{$_('home.tracking.group.fertility')}</h3>
				<div class="tracking-pills">
					<span class="pill">{$_('entryCard.labels.basalBodyTemp')}</span>
					<span class="pill">{$_('options.mucus.dry')}</span>
					<span class="pill">{$_('options.mucus.sticky')}</span>
					<span class="pill">{$_('options.mucus.creamy')}</span>
					<span class="pill">{$_('options.mucus.watery')}</span>
					<span class="pill">{$_('options.mucus.eggWhite')}</span>
					<span class="pill">{$_('entry.lhSurge')}</span>
				</div>
			</div>
			<div class="tracking-group">
				<h3 class="tracking-group-title">{$_('home.tracking.group.symptoms')}</h3>
				<div class="tracking-pills">
					<span class="pill">{$_('indicators.moodChange')}</span>
					<span class="pill">{$_('indicators.appetiteChange')}</span>
					<span class="pill">{$_('indicators.breastTenderness')}</span>
					<span class="pill">{$_('indicators.cramping')}</span>
					<span class="pill">{$_('indicators.mildSpotting')}</span>
					<span class="pill">{$_('indicators.fluidRetention')}</span>
					<span class="pill">{$_('indicators.cervixChanges')}</span>
					<span class="pill">{$_('indicators.heightenedSmell')}</span>
					<span class="pill">{$_('indicators.increasedSexDrive')}</span>
				</div>
			</div>
			<div class="tracking-group">
				<h3 class="tracking-group-title">{$_('home.tracking.group.intimacy')}</h3>
				<div class="tracking-pills">
					<span class="pill">{$_('options.intimacy.unprotected')}</span>
					<span class="pill">{$_('options.intimacy.protected')}</span>
				</div>
			</div>
		</div>
		<p class="methodology-link"><a href="/info">{$_('home.tracking.methodologyLink')}</a></p>
	</section>

	<!-- How It Works -->
	<section id="how-it-works" class="marketing-section">
		<h2 class="section-title">{$_('home.howItWorks.title')}</h2>
		<div class="cards">
			<div class="card">
				<div class="card-step" aria-hidden="true">1</div>
				<h3>{$_('home.howItWorks.step1Title')}</h3>
				<p>{$_('home.howItWorks.step1Body')}</p>
			</div>
			<div class="card">
				<div class="card-step" aria-hidden="true">2</div>
				<h3>{$_('home.howItWorks.step2Title')}</h3>
				<p>{$_('home.howItWorks.step2Body')}</p>
			</div>
			<div class="card">
				<div class="card-step" aria-hidden="true">3</div>
				<h3>{$_('home.howItWorks.step3Title')}</h3>
				<p>{$_('home.howItWorks.step3Body')}</p>
			</div>
		</div>
	</section>

	<!-- Free Tier Callout (moved up) -->
	<section id="free-tier" class="marketing-section">
		<div class="free-tier-card">
			<div class="free-tier-count">{data.spotsRemaining}</div>
			<div class="free-tier-label">
				{#if data.spotsRemaining > 0}
					{$_('home.freeTier.spotsRemaining')}
				{:else}
					{$_('home.freeTier.tierFull')}
				{/if}
			</div>
			<p class="free-tier-desc">
				{#if data.spotsRemaining > 0}
					{$_('home.freeTier.descWithSpots')}
				{:else}
					{$_('home.freeTier.descFull')}
				{/if}
			</p>
			<a href="/auth/register" class="cta">{$_('home.freeTier.claimSpot')}</a>
		</div>
	</section>

	<!-- Why Privacy Matters -->
	<section id="why-privacy" class="marketing-section">
		<h2 class="section-title">{$_('home.privacy.title')}</h2>
		<p class="section-lead">{$_('home.privacy.lead')}</p>
		<div class="cards">
			<div class="card">
				<div class="card-icon" aria-hidden="true">🔑</div>
				<h3>{$_('home.privacy.card1Title')}</h3>
				<p>{$_('home.privacy.card1Body')}</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">🚫</div>
				<h3>{$_('home.privacy.card2Title')}</h3>
				<p>{$_('home.privacy.card2Body')}</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">🔒</div>
				<h3>{$_('home.privacy.card3Title')}</h3>
				<p>{$_('home.privacy.card3Body')}</p>
			</div>
		</div>

		<div class="compare-table-wrap">
			<table class="compare-table">
				<thead>
					<tr>
						<th></th>
						<th>Lavender</th>
						<th>Clue</th>
						<th>Flo</th>
						<th>Natural Cycles</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>{$_('home.privacy.compareRow1')}</td>
						<td class="yes">✓</td>
						<td class="no">✗</td>
						<td class="no">✗</td>
						<td class="no">✗</td>
					</tr>
					<tr>
						<td>{$_('home.privacy.compareRow2')}</td>
						<td class="yes">{$_('home.privacy.compareNever')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
					</tr>
					<tr>
						<td>{$_('home.privacy.compareRow3')}</td>
						<td class="yes">{$_('home.privacy.compareNone')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
					</tr>
					<tr>
						<td>{$_('home.privacy.compareRow4')}</td>
						<td class="yes">{$_('home.privacy.compareImpossible')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
						<td class="no">{$_('home.privacy.compareYes')}</td>
					</tr>
					<tr>
						<td>{$_('home.privacy.compareRow5')}</td>
						<td class="yes">{$_('home.privacy.compareRow5Lavender')}</td>
						<td class="no">{$_('common.no')}</td>
						<td class="no">{$_('common.no')}</td>
						<td class="no">{$_('common.no')}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Pricing -->
	<section id="pricing" class="marketing-section alt">
		<h2 class="section-title">{$_('home.pricing.title')}</h2>
		<p class="pricing-coming-soon">{$_('home.pricing.comingSoon')}</p>
		<p class="section-lead">{$_('home.pricing.freeTierNote')}</p>
	</section>

	<!-- FAQ -->
	<section id="faq" class="marketing-section">
		<h2 class="section-title">{$_('home.faq.title')}</h2>
		<div class="faq-list">
			{#each [1, 2, 3, 4, 5] as n}
				<details class="faq-item">
					<summary class="faq-question">{$_(`home.faq.q${n}`)}</summary>
					<p class="faq-answer">{$_(`home.faq.a${n}`)}</p>
				</details>
			{/each}
		</div>
	</section>

	<footer class="landing-footer">
		<a href="/info">{$_('home.footer.methodology')}</a>
		<a href="/auth/register">{$_('home.footer.createAccount')}</a>
	</footer>
</div>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	:global(.hero-logo) {
		margin: 0 auto var(--space-lg);
	}
	a {
		color: #7a5cbf;
	}
	.cta-group {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
		flex-wrap: wrap;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 2rem;
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--color-text-inverse);
		background: var(--color-primary);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
		text-decoration: none;
	}
	.cta:hover {
		background: var(--color-primary-hover);
		color: var(--color-text-inverse);
	}
	.cta-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 2rem;
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--color-primary);
		background: transparent;
		border: 2px solid var(--color-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}
	.cta-secondary:hover:not(:disabled) {
		background: var(--color-primary-alpha);
	}
	.cta-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Marketing sections */
	.marketing {
		border-top: 1px solid var(--color-border);
	}
	.marketing-section {
		padding: 4rem 1.5rem;
		max-width: 72rem;
		margin: 0 auto;
	}
	.marketing-section.alt {
		background: var(--color-surface);
		max-width: none;
	}
	.marketing-section.alt > * {
		max-width: 72rem;
		margin-left: auto;
		margin-right: auto;
	}
	.section-title {
		font-size: var(--text-2xl, 1.75rem);
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--space-sm);
		text-align: center;
	}
	.section-lead {
		font-size: var(--text-lg);
		color: var(--color-text-muted);
		text-align: center;
		max-width: 52rem;
		margin: 0 auto var(--space-xl);
	}

	/* Cards */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--space-lg);
		margin-bottom: var(--space-xl);
	}
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		text-align: left;
	}
	.card-icon {
		font-size: 2rem;
		margin-bottom: var(--space-sm);
	}
	.card h3 {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--space-sm);
	}
	.card p {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	/* Comparison table */
	.compare-table-wrap {
		overflow-x: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}
	.compare-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		text-align: center;
	}
	.compare-table th {
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		font-weight: 600;
		color: var(--color-text);
		border-bottom: 1px solid var(--color-border);
	}
	.compare-table th:first-child {
		text-align: left;
	}
	.compare-table td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-muted);
	}
	.compare-table tr:last-child td {
		border-bottom: none;
	}
	.compare-table td:first-child {
		text-align: left;
		font-weight: 500;
		color: var(--color-text);
	}
	.compare-table td.yes {
		color: #16a34a;
		font-weight: 600;
	}
	.compare-table td.no {
		color: #dc2626;
	}

	/* Free tier callout */
	.free-tier-card {
		text-align: center;
		max-width: 28rem;
		margin: 0 auto;
		padding: var(--space-xl) var(--space-lg);
		background: var(--color-primary-alpha);
		border: 2px solid var(--color-primary);
		border-radius: var(--radius-xl, var(--radius-lg));
	}
	.free-tier-count {
		font-size: 5rem;
		font-weight: 800;
		color: var(--color-primary);
		line-height: 1;
		margin-bottom: var(--space-xs);
	}
	.free-tier-label {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--space-md);
	}
	.free-tier-desc {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-lg);
	}

	/* Footer */
	.landing-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xl);
		padding: var(--space-xl) var(--space-lg);
		border-top: 1px solid var(--color-border);
		flex-wrap: wrap;
		font-size: var(--text-sm);
	}
	.landing-footer a {
		color: var(--color-primary);
		text-decoration: none;
	}
	.landing-footer a:hover {
		text-decoration: underline;
	}

	/* App claim */
	.app-claim {
		font-size: var(--text-2xl, 1.75rem);
		font-weight: 700;
		color: var(--color-primary);
		margin: var(--space-sm) 0 var(--space-md);
		line-height: 1.2;
	}

	/* Hero additions */
	.tagline-subhead {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-top: var(--space-sm);
		line-height: 1.5;
	}

	/* Trust bar */
	.trust-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-xl);
		padding-top: var(--space-lg);
		border-top: 1px solid var(--color-border);
	}
	.trust-item {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--text-xs, 0.75rem);
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.trust-item a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	.trust-item a:hover {
		color: var(--color-primary);
	}

	/* Card step number */
	.card-step {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--color-primary);
		color: var(--color-text-inverse);
		font-size: var(--text-sm);
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: var(--space-sm);
	}

	/* Tracking groups */
	.tracking-groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-lg);
		margin-bottom: var(--space-lg);
	}
	.tracking-group {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
	}
	.tracking-group-title {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-sm);
	}
	.tracking-pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}
	.pill {
		font-size: var(--text-xs, 0.75rem);
		background: var(--color-primary-alpha);
		color: var(--color-primary);
		border-radius: var(--radius-md);
		padding: 0.2rem 0.6rem;
		white-space: nowrap;
	}
	.methodology-link {
		text-align: center;
		font-size: var(--text-sm);
		margin-top: var(--space-md);
	}
	.methodology-link a {
		color: var(--color-primary);
		text-decoration: none;
	}
	.methodology-link a:hover {
		text-decoration: underline;
	}

	/* Pricing */
	.pricing-coming-soon {
		font-size: var(--text-xl, 1.25rem);
		font-weight: 600;
		color: var(--color-text);
		text-align: center;
		margin-bottom: var(--space-sm);
	}

	/* FAQ */
	.faq-list {
		max-width: 52rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.faq-item {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.faq-item[open] {
		border-color: var(--color-primary);
	}
	.faq-question {
		list-style: none;
		padding: var(--space-md) var(--space-lg);
		font-weight: 600;
		font-size: var(--text-base, 1rem);
		color: var(--color-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		background: var(--color-surface);
	}
	.faq-question::-webkit-details-marker {
		display: none;
	}
	.faq-question::after {
		content: '+';
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.faq-item[open] .faq-question::after {
		content: '−';
	}
	.faq-question:hover {
		background: var(--color-primary-alpha);
	}
	.faq-answer {
		padding: var(--space-md) var(--space-lg);
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		line-height: 1.7;
		border-top: 1px solid var(--color-border);
	}
</style>
