# NTE Tracker 2.0 — Catalogue central et progression privée

## Ce que cette livraison implémente

Le **catalogue officiel** est `catalog/catalog.v2.json` dans le dépôt GitHub `MrDustyBowl/NTE-Tracker` sur `main`. À chaque démarrage, l'application vérifie ce fichier en HTTPS et peut aussi le contrôler avec le bouton **Check Database**. Elle valide la version du schéma, les identifiants, les catégories, les raretés et les relations avant d'accepter une nouvelle révision (`catalogRevision`). Les données invalides, rétrogradées ou supprimant des entrées existantes sont rejetées. Les anciennes entrées doivent être archivées, **jamais supprimées**.

Le catalogue accepté est mis en cache dans `%APPDATA%` / le dossier Tauri existant, sous `catalog-cache/catalog.v2.json`. Si GitHub est indisponible, l'application utilise ce cache, puis le catalogue embarqué si nécessaire. Elle ne télécharge *aucune* progression utilisateur. Les sauvegardes locales restent dans `nte.sqlite3` / table `catalog_progress`, avec export ZIP et sauvegardes quotidiennes préexistantes. Les données héritées de la v1 restent conservées dans l'ancienne table `items` ; elles ne sont pas automatiquement migrées vers les fiches v2. **Le profil v2 repart donc vierge si tu viens de la v1**, comme convenu.

Le **catalogue change sans réinstaller le logiciel**, lors du prochain démarrage ou de « Check Database ». Les **mises à jour du logiciel** (interface/backend) passent toujours par le système d'installateurs signés de Tauri. Les nouveaux portraits non inclus dans l'installateur utilisent un visuel de secours ; leur distribution dynamique pourra être ajoutée plus tard si nécessaire.

## Installation dans le dépôt existant — branche v2-development

1. Dans **GitHub Desktop**, sélectionne le dépôt `NTE-Tracker`, puis `Current Branch → v2-development`. Ne travaille pas sur `main` pour l'instant.
2. Décompresse l'archive de correctif et **copie son contenu à la racine du dossier `NTE-Tracker`**, en acceptant la fusion des dossiers. **Le correctif ne fournit pas `src-tauri/tauri.conf.json`**, pour ne pas remplacer ta clé de mise à jour Tauri.
3. Double-clique sur **`APPLIQUER_V2.bat`**. Il ajuste les versions dans `package.json`, `Cargo.toml` et `tauri.conf.json` à 2.0.0 **sans modifier l'identifiant d'application ni ta clé publique**, puis lance les tests de catalogue.
4. Dans GitHub Desktop, vérifie les différences, fais `Commit to v2-development`, puis `Push origin`.
5. Sur GitHub → **Actions** → **NTE v2 — Windows installer (development)** → dernier run vert → **Artifacts** → télécharge `NTE-Tracker-v2-Windows-Installer` (ZIP contenant l'installateur `.exe`). Il est compilé et signé dans ton dépôt, et n'est **pas** une release publique officielle.
6. **Avant d'installer**, fais une sauvegarde ZIP depuis ta version actuelle via **Data & Tools → Backup ZIP**. Vérifie que tes données sont exportées, puis ferme l'ancienne application.

**Conditions :** Node.js, clés de signature Tauri `TAURI_SIGNING_PRIVATE_KEY` et éventuellement `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` dans les secrets GitHub, clé publique réelle configurée dans ton `tauri.conf.json`, comme pour les mises à jour précédentes. Si le runner rouge, **ne traite pas le paquet comme stable** ; examine l'erreur et corrige avant de publier.

## Publier la première version stable

Après validation de l'installateur de développement sur Windows, fusionne `v2-development` vers `main` via Pull Request. Cette fusion publiera le fichier `catalog/catalog.v2.json` à l'URL officielle ET déclenchera le workflow de release Tauri existant, à condition que la version 2.0.0 ne soit pas déjà publiée.

**Attention :** tant que le fichier catalogue n'est pas encore présent sur `main`, l'application fonctionne hors ligne avec sa copie embarquée et le bouton Check Database renvoie « Offline mode ». Ce n'est pas un problème de SQLite : c'est juste que la source distante officielle n'a pas encore été publiée.

## Mettre à jour le catalogue après une mise à jour de NTE

1. Édite **seulement** `catalog/catalog.v2.json` sur la branche `main` (via branche + PR si tu préfères).
2. Conserve tous les identifiants `id` existants et incrémente l'entier `catalogRevision`, par exemple `1 → 2`. Ajoute les nouveaux personnages, Arcs, Items ou Sources dans leur table. Les champs encore inconnus peuvent garder `null` là où le schéma le permet.
3. Vérifie le workflow **Validate shared NTE catalogue** (les nouvelles données ne doivent pas être ambiguës/incohérentes).
4. Les utilisateurs récupéreront automatiquement les données au prochain lancement (ou en cliquant **Check Database**) : **aucune release `.exe` nécessaire**.

Le workflow de release `main` ignore les commits ne modifiant que `catalog/**`, ce qui évite de recompiler l'application pour les changements de données.

## Architecture conservée

- `catalog/catalog.v2.json` : **source globale**, seule propriété administrée par le mainteneur.
- `src-tauri/src/catalog_sync.rs` : HTTPS, validation, version monotone, cache récupérable, protection des IDs.
- `src-tauri/src/catalog_profile.rs` : progression privée des joueurs dans SQLite ; aucune écriture du catalogue ici.
- `src/catalog-main.js` : interface utilisant le catalogue distant ou hors ligne avec progression locale.
- `scripts/prepare-v2-live.cjs` : mise à niveau sûre des manifestes, idempotente.
- `scripts/check-catalog-revision.cjs` + workflow de validation : contrôle des versions et non-suppression d'IDs.

## Limites et vérifications restantes

Cette archive contient **le code source définitif à versionner**, pas un `.exe` précompilé. Les tests JavaScript ont été lancés. La compilation Rust, les tests natifs et l'installation réelle Windows doivent être validés par le workflow GitHub Actions avant d'appeler le build « stable ». Le catalogue initial contient bien les **24 noms de personnages et 51 Arcs du fichier utilisateur**, mais plusieurs raretés, données de Bond, Items et Achievements sont encore à renseigner ; ces inconnues restent signalées plutôt qu'inventées.

Aucune action GitHub n'a été effectuée par cette livraison : le commit/push reste à faire depuis ton GitHub Desktop.
