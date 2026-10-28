# NTE Tracker v1.2.3 — portraits et rangs

**Cette version ne remplace pas le backend SQLite et ne touche pas à la signature Tauri.**

## Correctifs
- Corrige le mélange des petites icônes de Mint, Nanally, Sakiri, Skia et Shinku.
- Corrige l’icône de Daffodill et son alias Daffodil.
- Portraits de liste ronds, avec le fond existant et un contour dégradé sombre en haut/clair en bas.
- Attribue le rang A à Mint, Skia, Edgar, Adler, Aurelia et Haniel ; rang S aux autres personnages du roster original.
- Les rangs sont ajoutés aux enregistrements SQLite seulement s’ils sont manquants ; les modifications manuelles restent possibles.
- Les grandes illustrations sont inchangées.

## Mise en place
1. Effectuer une sauvegarde ZIP depuis NTE Tracker.
2. Décompresser cette archive puis copier les fichiers `src/`, `index.html`, `scripts/` dans le dépôt local sans supprimer les autres fichiers.
3. À la racine du dépôt, exécuter : `node scripts/prepare-v1.2.3.cjs` puis `node test-v123.cjs` (et, si tu veux, `node test-v121.cjs`).
4. Vérifier les résultats, puis commit et push dans GitHub Desktop.
5. Vérifier que la Release v1.2.3 est bien publiée ; utiliser Check Updates depuis l’app.

Ne pas supprimer `src-tauri`, `.git`, `package.json` ou `package-lock.json`.
