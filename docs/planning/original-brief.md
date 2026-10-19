# MISSION

Tu es un ingénieur senior spécialisé Svelte 5, SvelteKit, Vite, Node.js, edge computing et performance web (Core Web Vitals). Ta mission : concevoir, développer, tester, documenter et préparer à la publication un package npm open source d'optimisation d'images pour Svelte 5 / SvelteKit, avec une couche CDN complète, qui soit la référence de sa catégorie.

Objectif : `npm i <PACKAGE_NAME>`, une ligne dans `vite.config.ts`, un composant `<Image>`, et le développeur obtient automatiquement les meilleures performances d'images possibles (LCP, CLS, poids), avec une DX irréprochable et zéro configuration obligatoire. Changer de CDN/provider ne doit demander de modifier que le fichier de configuration, jamais le code des composants.

Nom du package : propose 5 candidats (ex. `svelte-imgkit`, `imgkit-svelte`, `@scope/img`), vérifie leur disponibilité avec `npm view`, choisis le meilleur et justifie. `<PACKAGE_NAME>` désigne ce nom dans la suite.

# PRINCIPES NON NÉGOCIABLES

1. Vérifie, ne devine pas. Utilise la recherche web pour confirmer les versions stables ACTUELLES (Svelte, SvelteKit, Vite, @sveltejs/package, sharp, vitest, playwright, wrangler, Node LTS) ainsi que les fonctionnalités, limites et tarifs ACTUELS de chaque plateforme (Cloudflare, Vercel, Netlify, Bunny, etc.). N'invente jamais d'API : consulte la documentation officielle quand tu as un doute.
2. Svelte 5 uniquement (runes, snippets). Aucun code legacy Svelte 4.
3. Ne déclare jamais quelque chose « fini » sans l'avoir exécuté (builds, tests, apps d'exemple, `wrangler dev`, `docker compose`).
4. Ne promets jamais dans la doc « un CDN mondial inclus » : un package npm ne peut pas être un CDN. Il fournit trois couches (voir ci-dessous) et documente honnêtement la topologie recommandée (Origine → CDN), ses limites et ses coûts.
5. Prends les décisions de conception toi-même et note-les en ADR. Ne me pose une question que si une décision est bloquante et irréversible.
6. Code lisible, modulaire, sans sur-ingénierie, commenté là où c'est utile. Pas de TODO sans issue associée.

# ARCHITECTURE CDN EN TROIS COUCHES

Toutes pilotées par UN SEUL contrat d'URL et UNE SEULE configuration.

- Couche A : Providers. Brancher n'importe quel CDN/service d'images existant via une interface unique.
- Couche B : Edge Image Service. Un service d'images auto-hébergeable (notre « CDN maison ») à placer derrière un vrai CDN (Cloudflare, Bunny, Fastly).
- Couche C : Publication au build. Envoi des variantes générées vers un stockage objet/CDN, avec réécriture automatique des URLs.

# PHASE 0 : RECHERCHE ET CADRAGE (avant tout code)

1. Vérifie les versions actuelles et la compatibilité (voir principe 1).
2. Analyse l'existant : `@sveltejs/enhanced-img`, `vite-imagetools`, `svelte-img`, `@unpic/svelte`, `ipx`, `sveltekit-image-optimize` et équivalents récents. Produis un tableau comparatif (fonctionnalités, limites, DX, maintenance) dans `docs/research/competitive-analysis.md`.
3. Formule la proposition de valeur unique : un seul outil qui unifie (a) optimisation au build, (b) optimisation à la volée pour images distantes/dynamiques/CMS, (c) composants ultra-performants avec placeholders, (d) CLI d'audit/optimisation/déploiement, (e) compatibilité multi-adaptateurs et multi-CDN.
4. Rédige `docs/adr/0001-architecture.md` (décisions clés, alternatives rejetées, justification de chaque dépendance).
5. Présente-moi le plan en jalons AVANT d'écrire le premier fichier de code.

# CONTRAT D'URL UNIVERSEL (ADR dédié + `docs/spec/url-contract.md`)

Spécification stable et versionnée (`v1`), utilisée par tous les providers et par l'Edge Service, publiée en Markdown + JSON Schema/OpenAPI :
- Paramètres : source (`url` ou `key`), largeur, hauteur, DPR, qualité, format, fit (`cover|contain|fill|inside|outside|scale-down`), position (dont `attention`/`entropy` pour le recadrage intelligent), flou, netteté, couleur de fond, rotation, flip, métadonnées, animation, signature (`sig`), expiration (`exp`).
- Format : deux modes. (1) URL à format explicite (recommandé, cache-friendly). (2) Négociation par `Accept` avec normalisation de la clé de cache, car beaucoup de CDN gèrent mal `Vary: Accept` (documente la configuration pour Cloudflare, Fastly, Bunny, CloudFront).
- Clé de cache canonique : paramètres triés, normalisés, quantifiés en paliers (largeurs, qualités) pour éviter l'explosion de variantes.
- Presets nommés (`thumb`, `card`, `hero`, `og`) pour limiter les combinaisons autorisées et la surface d'abus.

# FONCTIONNALITÉS

## 1. Plugin Vite (build-time)
- Imports typés avec directives : `import hero from './hero.jpg?img&w=400;800;1200&format=avif;webp;jpg'`, et import magique `./hero.jpg?img` générant une config responsive sensée.
- Sortie typée : `sources` (par format), `srcset`, `src` de repli, `width`, `height`, `aspectRatio`, `placeholder`, `dominantColor`.
- Formats : AVIF, WebP, JPEG (mozjpeg), PNG optimisé, SVG (SVGO), GIF animé → WebP/AVIF animé ou vidéo optionnelle. Lecture de formats exotiques : HEIC/HEIF, TIFF, BMP, ICO, JXL.
- Placeholders au choix : thumbhash, blurhash, LQIP base64 (< 1 Ko), couleur dominante, aucun. Défaut : thumbhash ou LQIP.
- Cache disque persistant (hash du contenu + paramètres) dans `node_modules/.cache/<PACKAGE_NAME>`, invalidation correcte, traitement incrémental.
- Pool de workers (`worker_threads`), concurrence configurable, progression discrète.
- Dev server : traitement paresseux à la demande, démarrage rapide, HMR fonctionnel, aucune génération complète au lancement.
- Noms de fichiers avec hash de contenu, `Cache-Control: immutable` documenté.
- EXIF : rotation automatique, suppression des métadonnées sensibles (GPS) par défaut, option pour garder le profil colorimétrique. Gestion ICC, CMYK, transparence.
- Types ambiants (`*.jpg?img`, `*.png?img`, etc.) via `<PACKAGE_NAME>/types`.

## 2. Famille de composants Svelte 5
Runes, snippets, SSR-safe, compatibles hydratation, aucun accès à `window` hors `$effect`/`onMount`, zéro dépendance client, cible < 1,5 Ko gzip pour le composant de base.

- `<Image>` : cas simple (90 % des usages). `<img>` avec `srcset`/`sizes`, `width`/`height` explicites, `aspect-ratio` CSS (CLS = 0), placeholder, `priority`.
  - Props : `src` (import ou URL), `alt` (OBLIGATOIRE au niveau TypeScript ; `alt=""` explicite pour le décoratif), `sizes`, `priority`, `loading`, `decoding`, `fetchpriority`, `fit`, `position`, `placeholder`, `quality`, `provider`, `class`, `...rest` pour les attributs HTML natifs.
  - `priority` = `loading="eager"` + `fetchpriority="high"` + `decoding="sync"` + `<link rel="preload" as="image" imagesrcset imagesizes>` via `<svelte:head>`.
- `<Picture>` : contrôle total, `<picture>` avec plusieurs `<source>` : formats multiples, direction artistique par media queries, variantes dark mode (`prefers-color-scheme`), densités, ratios différents par breakpoint, `type` et `media` explicites, snippets `{#snippet source()}` pour les cas avancés. Mêmes props de performance que `<Image>`.
- `<BackgroundImage>` : fond responsive (`image-set`, variantes par media query, repli sans `image-set`).
- `<ImageMeta>` : `og:image`, `twitter:image`, `image_src` avec dimensions et type corrects.
- API headless `getImageProps(options)` : retourne les attributs prêts à étaler (`srcset`, `sizes`, `src`, `width`, `height`, `style`, `sources`) pour construire carrousels, lightbox, cards sans nos composants.
- Optionnels si justifiés : `<Avatar>` (fallback initiales), `<ImageGrid>`.
- Placeholder : fondu enchaîné, désactivé si `prefers-reduced-motion`, fonctionne sans JavaScript (CSS inline), gère l'image déjà en cache avant hydratation (pas de flash).
- Snippets `{#snippet loading()}` / `{#snippet error()}` et événements `onload`/`onerror`.
- `sizes` : syntaxe courte et valeurs par défaut sensées ; étudie `sizes="auto"` pour les images lazy après vérification de la compatibilité navigateurs actuelle.
- Gestion de `Save-Data`, `content-visibility`, View Transitions (nom optionnel), alt traduisible (i18n), contexte (`setContext`) pour une config par sous-arbre.

## 3. Couche A : Providers
Interface TypeScript unique `ImageProvider` : `buildUrl(params) → string`, `capabilities` (formats, fit, smart-crop, animation, signature), `validate(config)`, `purge?(keys)`. Un provider custom doit tenir en ~10 lignes. Chaque provider est un sous-chemin tree-shakable `<PACKAGE_NAME>/providers/<nom>`.

- `local` (sharp), `edge` (couche B), `generic` (template d'URL).
- `cloudflare` : gère toutes les voies (URL `/cdn-cgi/image/`, `fetch` avec `cf.image`, binding Images dans un Worker, Cloudflare Images hébergé). Vérifie prérequis (activation sur la zone) et limites actuelles.
- `vercel`, `netlify`, `bunny` (Optimizer), `imgix`, `cloudinary`, `imagekit`, `imgproxy`, `ipx`, `supabase`, `fastly`, `cloudfront`, `uploadcare` si pertinent.
- Helpers CMS reconnaissant et optimisant les URLs de Sanity, Contentful, Strapi, Directus, WordPress, Storyblok, Prismic, DatoCMS, Shopify, Unsplash.
- Chaîne de repli `fallback: [providerA, providerB]` avec disjoncteur (timeout, 5xx → provider suivant puis image originale).
- Sélection par domaine : `providers: { 'cdn.monsite.com': cloudflare(), '*': local() }`.

## 4. Runtime SvelteKit et `imageAdapter()`
- Route `/_img` / hook `handle` : resize, format, qualité, fit, négociation `Accept` (AVIF > WebP > original).
- `imageAdapter()` détecte l'adapter SvelteKit (static, node, auto, vercel, netlify, cloudflare, bun, deno) et applique la bonne stratégie :
  - static : variantes au build (+ couche C optionnelle)
  - node/bun : sharp local + cache disque
  - vercel/netlify/cloudflare : provider natif par défaut, sharp désactivé automatiquement si indisponible
  - erreur claire et actionnable si la combinaison runtime/provider est impossible
- Cache : LRU mémoire + disque, ETag, `Cache-Control` agressif, `Vary: Accept`, `stale-while-revalidate`, déduplication des requêtes concurrentes (anti-stampede).
- En-tête HTTP `Link: <...>; rel=preload; as=image` (et 103 Early Hints si la plateforme le permet) pour l'image LCP, en plus du `<link>` dans le `<head>`. Documente la compatibilité par plateforme.
- Compatibilité prerender, streaming SSR, `transformPageChunk`.

## 5. Couche B : Edge Image Service (« CDN maison »)
Sous-package `@scope/<PACKAGE_NAME>-edge` (ou sous-chemin `./edge`) implémentant le contrat d'URL, déployable sur :
- **Cloudflare Workers** (cible prioritaire) : binding Images ou `cf.image` en priorité ; repli WASM (type jSquash/Squoosh) si nécessaire avec mesure et documentation des limites CPU/mémoire ; Cache API ; R2 comme cache d'origine de second niveau ; `ctx.waitUntil` ; `wrangler.toml` prêt à l'emploi.
- **Node / Bun / Docker** (sharp) : image minimale durcie (non-root, healthcheck), `docker-compose.yml` d'exemple avec reverse-proxy, cache disque + LRU.
- **Deno Deploy**, Vercel/Netlify Edge si faisable, sinon documente pourquoi non.
- Fonctions : négociation de format, DPR, `Save-Data`, Client Hints (implications de cache documentées), `Cache-Control: public, max-age=31536000, immutable` pour les URLs signées/hashées, ETag, `304`, `Vary` correct, `stale-while-revalidate`, anti-stampede, `Server-Timing`, `Content-Disposition`, `Accept-Ranges`, CORS configurable, `X-Content-Type-Options: nosniff`, CSP adaptée aux SVG.
- Observabilité : logs structurés, compteurs (hit/miss, latence, octets), `/health` et `/metrics` optionnels, hooks OpenTelemetry. RGPD : pas de logs d'IP par défaut.
- Purge/invalidation par clé, préfixe ou tag (API + CLI), selon ce que supporte chaque plateforme.
- Garde-fous de coût (budget guard) et rate limiting contre les abus.

## 6. Couche C : Publication au build
Plugin `publish` envoyant les variantes vers un stockage + CDN et réécrivant les URLs :
- Cibles via interface `StorageTarget` : Cloudflare R2, Amazon S3/CloudFront, Bunny Storage, Backblaze B2, Vercel Blob, Supabase Storage, toute API compatible S3.
- Upload incrémental (comparaison par hash), parallèle, reprise sur échec, `--dry-run`, manifeste `image-manifest.json` versionné.
- Réécriture des URLs via le mécanisme SvelteKit approprié (`paths.assets`/`paths.base` ou équivalent, à vérifier dans la doc actuelle).
- En-têtes de cache immutables, garbage collection optionnelle et prudente des anciennes variantes.
- Compatible `adapter-static` : le site statique référence directement le CDN.

## 7. CLI `npx <PACKAGE_NAME>`
- `init` : détecte le projet, configure le plugin Vite, ajoute les types, crée un exemple.
- `optimize <dir>` : optimisation par lots, rapport avant/après, `--dry-run`, `--watch`.
- `audit` : scanne `.svelte`, `.md`, CSS ; signale `<img>` sans `alt`/`width`/`height`/`loading`, images non optimisées ou trop lourdes, image LCP probable sans `priority`, formats obsolètes. Sortie lisible + `--json` + code de sortie non nul pour la CI.
- `deploy cloudflare|docker` : génère la config, vérifie les prérequis, guide le déploiement, jamais d'action destructive ou facturée sans confirmation explicite.
- `purge` : purge par clé/préfixe/tag.
- `migrate` : codemods depuis `@sveltejs/enhanced-img` et `vite-imagetools`.
- Sortie soignée, support `NO_COLOR`, erreurs actionnables.

## 8. Configuration centrale
`<PACKAGE_NAME>.config.ts` avec `defineConfig()` fortement typé et validé (messages d'erreur clairs) : providers, presets, breakpoints et paliers de largeur, formats et qualités par défaut, domaines autorisés, placeholder par défaut, stratégie de cache, clés de signature (variables d'environnement uniquement, jamais côté client), options CDN/publication, mode debug. Surcharge par composant et par import. JSON Schema pour l'autocomplétion.

## 9. Bonus (planifier, implémenter si le temps le permet)
Preprocessor Svelte transformant les `<img src="./x.jpg">` statiques ; overlay de dev signalant les mauvaises pratiques ; support mdsvex/Markdown ; utilitaire de sitemap d'images ; intégration Lighthouse CI d'exemple ; guide PWA/service worker ; intégration Storybook et Tailwind.

# STACK ET STRUCTURE

- Un package publié avec exports par sous-chemins (`.`, `./vite`, `./kit`, `./providers/*`, `./edge`, `./publish`, `./cli`, `./types`) via `svelte-package`. `exports` map complète (conditions `svelte`, `types`, `default`), ESM uniquement, `sideEffects` déclaré, tree-shaking vérifié.
- Monorepo pnpm : `packages/<PACKAGE_NAME>`, `packages/edge`, `apps/docs` (SvelteKit), `examples/` (SvelteKit basique, adapter-static, adapter-node, Cloudflare Worker, CMS distant), `bench/`.
- TypeScript strict, types testés (`tsd`/`expect-type`), JSDoc complet sur l'API publique.
- `sharp` géré proprement s'il est absent ou incompatible (message utile, pas de crash obscur).
- Le code serveur/Node ne doit JAMAIS fuiter dans le bundle client : test qui analyse le bundle produit.
- Zéro dépendance inutile. Outillage : ESLint + eslint-plugin-svelte, Prettier, Changesets, commitlint (Conventional Commits), husky/lint-staged.

# SÉCURITÉ (`SECURITY.md` avec modèle de menace)

- SSRF : liste blanche obligatoire, blocage IP privées/locales/metadata cloud, limites de redirections, protection DNS rebinding.
- Path traversal sur les sources locales.
- URLs signées HMAC avec expiration et rotation de clés ; presets verrouillés ; limites de taille/qualité/formats.
- `limitInputPixels` (decompression bombs), taille max d'entrée/sortie, timeouts.
- Validation du type réel par magic bytes ; sanitisation des SVG (pas de scripts).
- Pas de télémétrie (ou opt-in explicite et documentée) ; GPS supprimé par défaut ; secrets jamais exposés au client.

# QUALITÉ ET TESTS

- Unitaires (vitest) : srcset/sizes, parseur de directives, loaders/providers, cache, clé canonique, signature, pipeline sharp avec fixtures (JPEG, PNG, WebP, AVIF, SVG, GIF animé, EXIF orienté, très grande image, fichier corrompu, HEIC, CMYK).
- Composants (@testing-library/svelte ou vitest browser mode) : rendu SSR et client, props, accessibilité, placeholder, `priority`.
- E2E (Playwright) sur les exemples, dont `wrangler dev`/Miniflare et `docker compose` : bons formats servis, CLS = 0, image LCP préchargée, lazy loading, comportement du fallback.
- Sécurité automatisée : SSRF (IP privées, metadata, redirections, DNS rebinding), traversal, signatures invalides/expirées, bombes de décompression, SVG piégés.
- Cache : taux de hit > 95 % au second passage, nombre de variantes borné et testé.
- Benchmarks reproductibles : temps de build et poids vs `@sveltejs/enhanced-img` et `vite-imagetools` ; TTFB froid/chaud, débit, mémoire vs `ipx` et le provider natif Cloudflare. Résultats publiés honnêtement.
- Couverture > 90 % sur le cœur. CI GitHub Actions : matrice Node LTS × OS (Linux, macOS, Windows), lint, typecheck, tests, build, `publint`, `arethetypeswrong`, budget de taille de bundle qui fait échouer la CI.

# DOCUMENTATION

- README percutant : promesse en une phrase, comparaison avant/après, install en 3 étapes, exemple minimal, tableau comparatif honnête. Version française en bonus.
- Site de docs SvelteKit : Getting started, guides (images locales, distantes, CMS, adapters, art direction, LCP), référence API, recettes, migration, FAQ, dépannage, sécurité, playground.
- **Guide de topologie CDN** (Origine → CDN, config de cache par plateforme) et **tableau des coûts** par provider, à partir de la doc officielle à jour, avec conseils pour rester dans les paliers gratuits.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` (MIT), templates d'issues/PR. Doc du code et de l'API en anglais.

# PUBLICATION

Changesets, publication npm avec provenance (`--provenance`), workflow de release automatisé, `CHANGELOG.md` généré, champs `package.json` complets (keywords, repository, bugs, homepage, engines, funding), `files` restreint, vérification `npm pack --dry-run`. Politique de versionnage, matrice de compatibilité, politique de dépréciation. Première version `0.1.0` en tag `next`, puis `1.0.0` quand tous les critères ci-dessous sont atteints.

# CHECKLIST « AVOIR PENSÉ À TOUT » (à vérifier point par point dans REPORT.md)

- Performance : LCP (preload + fetchpriority + Link header), CLS (dimensions + aspect-ratio), INP (aucun JS bloquant), poids (AVIF/WebP, qualité perceptuelle adaptative), `srcset` sans variantes inutiles, DPR, Save-Data, coût de décodage AVIF, images hors écran différées, GIF → vidéo/WebP.
- Fiabilité : 404/timeouts/images cassées, fallback d'erreur, formats exotiques, très grandes images, EXIF, ICC, CMYK, transparence, fichiers corrompus, concurrence.
- Sécurité : tout le chapitre sécurité ci-dessus.
- DX : zéro config, types complets, erreurs actionnables, overlay de dev, CLI complet, codemods, playground.
- Écosystème : tous les adapters officiels SvelteKit, Vite, mdsvex, Storybook, Vitest, Playwright, Tailwind, monorepos, SSR/SSG/SPA, PWA.
- Accessibilité : alt obligatoire, `alt=""` explicite pour le décoratif, reduced-motion, pas d'information portée par la seule couleur.
- SEO : OG/Twitter, sitemap d'images, dimensions, `loading` approprié, audit des alt.
- Légal : GPS supprimé, pas de télémétrie, RGPD de l'Edge Service.
- Coûts : tableau, budget guard, paliers gratuits.
- Maintenance : versionnage, compatibilité, dépréciation, process de release.

# MÉTHODE ET JALONS

Travaille jalon par jalon. À la fin de chacun : tests verts, lint propre, typecheck OK, commit Conventional Commits, courte note de statut (fait / reste / risques). Ne passe au suivant qu'après mon feu vert.

- M1 : cœur de traitement + cache + contrat d'URL (ADR)
- M2 : plugin Vite
- M3 : composants `<Image>`, `<Picture>`, `getImageProps`, `<BackgroundImage>`, `<ImageMeta>`
- M4 : runtime SvelteKit + `imageAdapter()` + providers principaux (local, cloudflare, vercel, netlify, generic)
- M5 : Edge Image Service (Cloudflare Worker puis Docker/Node)
- M6 : providers additionnels + intégrations CMS + chaîne de repli
- M7 : publication au build vers R2/S3/Bunny (couche C)
- M8 : CLI (`init`, `optimize`, `audit`, `deploy`, `purge`, `migrate`)
- M9 : sécurité complète + tests (E2E sur `wrangler dev`/Miniflare et `docker compose`)
- M10 : docs + exemples + benchmarks + guide de topologie CDN + tableau des coûts
- M11 : packaging + CI + release

# CRITÈRES DE RÉUSSITE (Definition of Done)

- Installation et première image optimisée en moins de 2 minutes sur un projet SvelteKit neuf.
- Page d'exemple à 100/100 Lighthouse Performance sur la partie images, CLS = 0, LCP préchargé.
- Réduction de poids médiane ≥ 60 % vs sources non optimisées sur le jeu de test.
- Temps de build au moins équivalent à `vite-imagetools` (cache + parallélisme, benchmark à l'appui).
- Aucune fuite de code serveur dans le bundle client ; composant de base < 1,5 Ko gzip.
- Le même `<Image>`/`<Picture>` fonctionne sans modification de code en changeant de provider (local → cloudflare → edge → cloudinary) : seule la config change.
- Edge Service déployable sur Cloudflare Workers en moins de 10 minutes via `npx <PACKAGE_NAME> deploy cloudflare`.
- Fonctionne sur adapter-static, node, vercel, netlify, cloudflare (documenté et testé pour ceux qui sont testables).
- Tous les tests, la CI, `publint` et `arethetypeswrong` passent ; couverture > 90 % sur le cœur.
- Les limites de chaque plateforme sont documentées honnêtement : rien n'est promis qui n'ait été vérifié par exécution ou par la doc officielle à jour.

# LIVRABLES FINAUX

Dépôt complet prêt à publier, `REPORT.md` (architecture, choix, checklist « penser à tout » cochée point par point, benchmarks, limites connues, roadmap v1.x) et la liste exacte des commandes pour publier sur npm.

Commence maintenant par la Phase 0, puis présente-moi ton plan en jalons avant d'écrire le premier fichier de code.