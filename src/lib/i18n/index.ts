import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

const STORAGE_KEY = 'lavender_language';
const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = [
	{ value: 'en', label: 'English' },
	{ value: 'es', label: 'Español' },
	{ value: 'fr', label: 'Français' }
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['value'];

register('en', () => import('./en.json'));
register('es', () => import('./es.json'));
register('fr', () => import('./fr.json'));

export function getStoredLocale(): SupportedLocale {
	if (!browser) return DEFAULT_LOCALE;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'en' || stored === 'es' || stored === 'fr') return stored;
	// Try to match browser language
	const lang = navigator.language.slice(0, 2);
	if (lang === 'es' || lang === 'fr') return lang;
	return DEFAULT_LOCALE;
}

export function storeLocale(locale: SupportedLocale): void {
	localStorage.setItem(STORAGE_KEY, locale);
}

export function setupI18n(): void {
	init({
		fallbackLocale: DEFAULT_LOCALE,
		initialLocale: getStoredLocale()
	});
}
