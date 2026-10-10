# Interface language audit

The application uses English by default. This audit covers the 110 country/region codes registered in `kalCountryCodes` and `regional-sources.json`. The catalog contains 95 language/script choices: 87 have local translation dictionaries, and eight are explicitly unavailable.

All 87 available dictionaries contain the same 1,070 interface keys. The offline audit checks key parity, nonempty values, preserved HTML and interpolation tokens, correct script variants, right-to-left direction, country mappings, duplicate language codes, static HTML keys, and dynamic bilingual interface calls with literal arguments. The extractor skips comments, quoted code, and regular expressions, and reads calls inside nested template expressions; the audit includes runnable call and array extraction regressions. It does not translate journal entries, account names, uploaded documents, or news content.

Available right-to-left interfaces: Arabic, Central Kurdish, Persian, Hebrew, and Urdu. Chinese has Simplified/Traditional variants; Serbian, Azerbaijani, Uzbek, and Tamazight have explicit script variants where used. Norwegian Bokmål and Nynorsk have separate dictionaries.

## Pending translations

These entries remain visible but disabled in the language menu. They have no English-copy dictionary pretending to be translated.

| Country | Code | Language |
| --- | --- | --- |
| Zimbabwe | `bzw` | Chibarwe |
| Zimbabwe | `kck` | Kalanga |
| Zimbabwe | `khi` | Khoisan languages |
| Zimbabwe | `nd` | Northern Ndebele |
| Zimbabwe | `ndc` | Ndau |
| Zimbabwe | `nmq` | Nambya |
| Zimbabwe | `toi` | Tonga |
| Switzerland | `rm` | Romansh |

Country mappings use Unicode CLDR national official and de facto official statuses, with national language/script overrides for South Africa, Ethiopia, Zimbabwe, Switzerland, Iraq, Algeria, Morocco, New Zealand, China/Taiwan/Hong Kong, and Serbian-language countries. Official regional languages are outside the requested national-language scope. Sign languages require a separate signed interface and are not represented by text translations. Bolivia is not a registered country in the current application.

## Translation quality and operation

Translations were generated at build time from interface copy only. Google supplied most translations; Apertium converted translated Bokmål into Nynorsk. Standard alphabet conversion preserves distinct Serbian/Azerbaijani/Uzbek scripts. Trading-journal navigation terminology received targeted corrections in several major languages. Native speakers have not reviewed every phrase; this is a structural and terminology audit, not certification of native linguistic quality.

Runtime translation uses local JSON files. No external translation service receives user records or publisher content. If a saved language file fails to load, initialization recovers to the already loaded English dictionary. A later explicit language-change failure preserves the current language and allows retry.

Run the offline audit with `node scripts/audit-locales.cjs`. `scripts/build-locales.cjs` is a manual maintenance command that uses external translation services; CI must never run it. Build caches live in the operating system temporary directory, outside the served application. Canonical additions live in `scripts/locale-extra.json`; `js/locales/en.json` is the complete English source dictionary.

Sources: [Unicode CLDR territory information](https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/territoryInfo.json), [Zimbabwe Constitution, section 6](https://www.constituteproject.org/constitution/Zimbabwe_2017).
