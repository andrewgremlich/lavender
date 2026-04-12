<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import Text from '$lib/components/ui/Text.svelte';

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
			demoError = e instanceof Error ? e.message : 'Could not start demo';
		} finally {
			tryingDemo = false;
		}
	}

	const ogDescription = $derived(
		data.spotsRemaining > 0
			? `Your cycle data belongs to you. Everything is encrypted before it leaves your device. ${data.spotsRemaining} free sync spots remaining.`
			: 'Your cycle data belongs to you. Everything is encrypted before it leaves your device.',
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
			description: 'Free cross-device sync for the first 100 users',
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
	<title>Lavender — Private Fertility Tracker, End-to-End Encrypted</title>
	<meta
		name="description"
		content="Track your cycle with complete privacy. Lavender encrypts all health data on your device — the server never sees your information. AES-256-GCM, no third-party analytics."
	/>
	<link rel="canonical" href="{data.origin}/" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Lavender" />
	<meta property="og:title" content="Lavender — Private Fertility Tracker" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:url" content="{data.origin}/" />
	<meta property="og:image" content="{data.origin}/og" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="Lavender — {data.spotsRemaining} free spots remaining for cross-device sync"
	/>

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Lavender — Private Fertility Tracker" />
	<meta name="twitter:description" content="E2EE cycle tracking. Your health data stays yours." />
	<meta name="twitter:image" content="{data.origin}/og" />

	<!-- JSON-LD structured data -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${jsonLd}<` + `/script>`}
</svelte:head>

<main>
	<Logo size="xl" class="hero-logo" />
	<Text as="h1">Lavender</Text>
	<Text variant="muted">
		A gentle companion for your personal wellness journey. Track, reflect, and bloom at your own
		rhythm. <a href="/info">About Lavender</a>
	</Text>
	<div class="cta-group">
		<a href="/auth/login" class="cta">Sign in</a>
		<button class="cta-secondary" onclick={handleDemoLogin} disabled={tryingDemo}>
			{tryingDemo ? 'Starting…' : 'Try it out'}
		</button>
	</div>
	{#if demoError}
		<Text variant="error">{demoError}</Text>
	{/if}
</main>

<div class="marketing">
	<!-- Why Privacy Matters -->
	<section id="why-privacy" class="marketing-section">
		<h2 class="section-title">Why privacy matters here</h2>
		<p class="section-lead">
			Fertility and cycle data is among the most sensitive personal information you can share. Most
			apps monetize it. Lavender doesn't — because we can't.
		</p>
		<div class="cards">
			<div class="card">
				<div class="card-icon" aria-hidden="true">🔑</div>
				<h3>Your key, your data</h3>
				<p>
					Encryption happens on your device before anything is sent. We use AES-256-GCM with a key
					derived from your password via PBKDF2 (100,000 iterations, SHA-256). The key never reaches
					our servers — not even we can read your entries.
				</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">🚫</div>
				<h3>No trackers. No ads.</h3>
				<p>
					Lavender has no third-party analytics, no advertising SDK, and no telemetry that leaves
					your device. Most fertility apps profit from selling cycle data. We don't.
				</p>
			</div>
			<div class="card">
				<div class="card-icon" aria-hidden="true">🔒</div>
				<h3>Forget your password? That's the point.</h3>
				<p>
					There's no "forgot password" flow that could expose your records — we don't have them. A
					recovery code lets you regain access without any server-side decryption. Lose both and your
					data is gone. That's intentional.
				</p>
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
						<td>Encrypted on device</td>
						<td class="yes">✓</td>
						<td class="no">✗</td>
						<td class="no">✗</td>
						<td class="no">✗</td>
					</tr>
					<tr>
						<td>Server sees health data</td>
						<td class="yes">Never</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
					</tr>
					<tr>
						<td>Third-party analytics</td>
						<td class="yes">None</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
					</tr>
					<tr>
						<td>Password reset exposes records</td>
						<td class="yes">Impossible</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
						<td class="no">Yes</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- What We Store -->
	<section id="what-we-store" class="marketing-section alt">
		<h2 class="section-title">What we actually store</h2>
		<p class="section-lead">
			Full transparency on every piece of data that touches our servers — and whether it's readable
			by anyone.
		</p>

		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th>Data</th>
						<th>Encrypted?</th>
						<th>Notes</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Health entries<br /><small>BBT, bleeding, symptoms, mucus, notes</small></td>
						<td><span class="badge badge-yes">Yes — AES-256-GCM</span></td>
						<td>Server stores opaque ciphertext only</td>
					</tr>
					<tr>
						<td>IV per entry</td>
						<td><span class="badge badge-no">No</span></td>
						<td>12 random bytes required to decrypt; harmless without the key</td>
					</tr>
					<tr>
						<td>Entry expiry date</td>
						<td><span class="badge badge-no">No</span></td>
						<td>Server uses this to auto-delete entries past your retention window</td>
					</tr>
					<tr>
						<td>Username</td>
						<td><span class="badge badge-no">No</span></td>
						<td>Login identity; not linked to personal info</td>
					</tr>
					<tr>
						<td>Password</td>
						<td><span class="badge badge-hash">Bcrypt hash</span></td>
						<td>Plaintext never stored or transmitted after hashing</td>
					</tr>
					<tr>
						<td>Wrapped encryption key</td>
						<td><span class="badge badge-yes">Yes — AES-wrapped</span></td>
						<td>Stored only if you set up a recovery code; recovery code never sent to server</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="cipher-example">
			<h3 class="cipher-title">What the server actually sees</h3>
			<p class="cipher-subtitle">Representative example — not real data</p>
			<div class="cipher-block">
				<div class="cipher-row">
					<span class="cipher-label">What you type</span>
					<code class="cipher-value"
						>&#123; "date": "2026-04-03", "basalBodyTemp": 36.7, "bleedingStart": true, "bleedingFlow":
						"medium", "notes": "Day 1 of cycle" &#125;</code
					>
				</div>
				<div class="cipher-row">
					<span class="cipher-label">What the server stores</span>
					<code class="cipher-value"
						>&#123; "encryptedData": "a3Fz9P+k2mWq8vNcXe1oLs7Yw4HrBt6jMpDnQeRzUf...", "iv":
						"R7xQ2pLm9vKs3nJe" &#125;</code
					>
				</div>
				<div class="cipher-row">
					<span class="cipher-label">Encryption method</span>
					<code class="cipher-value"
						>AES-256-GCM · key via PBKDF2 (100,000 × SHA-256) · key lives in sessionStorage only</code
					>
				</div>
			</div>
		</div>
	</section>

	<!-- Free Tier Callout -->
	<section id="free-tier" class="marketing-section">
		<div class="free-tier-card">
			<div class="free-tier-count">{data.spotsRemaining}</div>
			<div class="free-tier-label">
				{#if data.spotsRemaining > 0}
					free cross-device sync spots remaining
				{:else}
					free tier is full
				{/if}
			</div>
			<p class="free-tier-desc">
				{#if data.spotsRemaining > 0}
					The first 100 users get cross-device sync free, forever. After that it will be paywalled.
				{:else}
					The free tier is full. Cross-device sync will be available as a paid feature.
				{/if}
			</p>
			<a href="/auth/register" class="cta">Claim your spot</a>
		</div>
	</section>

	<footer class="landing-footer">
		<a href="/info">Detailed methodology &amp; calculations →</a>
		<a href="/auth/register">Create an account</a>
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

	/* Data table */
	.table-wrap {
		overflow-x: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		margin-bottom: var(--space-xl);
	}
	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	.data-table th {
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface-raised, var(--color-surface));
		font-weight: 600;
		color: var(--color-text);
		border-bottom: 1px solid var(--color-border);
		text-align: left;
	}
	.data-table td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-muted);
		vertical-align: top;
	}
	.data-table tr:last-child td {
		border-bottom: none;
	}
	.data-table td:first-child {
		font-weight: 500;
		color: var(--color-text);
	}
	.data-table small {
		display: block;
		font-weight: 400;
		color: var(--color-text-muted);
		margin-top: 2px;
	}
	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.badge-yes {
		background: #dcfce7;
		color: #15803d;
	}
	.badge-no {
		background: #fee2e2;
		color: #b91c1c;
	}
	.badge-hash {
		background: #fef9c3;
		color: #854d0e;
	}

	/* Ciphertext example */
	.cipher-example {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}
	.cipher-title {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: 0.25rem;
	}
	.cipher-subtitle {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-md);
	}
	.cipher-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.cipher-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.cipher-label {
		font-size: var(--text-xs, 0.75rem);
		font-weight: 600;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.cipher-value {
		display: block;
		font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.8rem;
		color: #f3f4f6;
		background: #1e1e2e;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
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
</style>
