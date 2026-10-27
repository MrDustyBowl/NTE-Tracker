# NTE Tracker v1.2 — Refonte UI + catalogue des 24 portraits

**Patch à appliquer sur TON dépôt GitHub actuel v1.1, pas un projet à cloner.** Ne désinstalle pas la v1.1 avant de tester la mise à jour. Les niveaux et succès vivent dans SQLite et ne sont pas remplacés par ce patch.

## Ce qui change

- Nouvelle interface inspirée des menus du jeu : anthracite, rose vif, touches jaunes, panneaux personnages, compétences, éveil, Bond et Arcs liés.
- Les 24 portraits ont une URL d'illustration de référence. **Ces illustrations ne sont pas incluses dans le ZIP/installer** : le logiciel essaie de les charger sur Internet; si une source est indisponible, il essaie une seconde source puis affiche des initiales. L'illustration Zankou provenant de la capture précédente reste incluse. Les portraits personnalisés enregistrés via l'éditeur sont prioritaires et stockés localement.
- Les données SQLite, les sauvegardes ZIP et l'updater signé continuent de fonctionner sans modification de schéma.

## Installation des sources / publication

1. Ouvre NTE Tracker v1.1 et crée une **Backup ZIP**. Conserve la sauvegarde en lieu sûr. Ferme le logiciel.
2. Dans GitHub Desktop : **Repository → Show in Explorer**. Décompresse le ZIP du patch, puis copie **son contenu** dans la racine de ton dossier `NTE-Tracker`, en remplaçant les fichiers correspondants. Ne supprime ni `.git` ni `src-tauri/`.
3. Dans le dossier du dépôt, ouvre PowerShell et lance :

   ```powershell
   node scripts/prepare-v1.2.cjs
   node test-ui.cjs
   node test-updater.cjs
   ```

   Le premier script modifie **sur ton PC** le numéro de version des trois fichiers nécessaires et autorise le chargement des sources de portraits, tout en préservant la clé PUBLIQUE existante de Tauri. Il ne lit/écrit pas de clés privées.
4. Vérifie dans GitHub Desktop que `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et `package.json` indiquent `1.2.0`. Vérifie aussi qu'**aucun** fichier `.key`, mot de passe, base SQLite ou portrait tiers téléchargé n'est sélectionné pour le commit.
5. **Commit to main → Push origin.** Avec ton workflow `Publish signed update` existant, GitHub doit générer la release `v1.2.0` si les secrets de signature sont toujours configurés.
6. Si la compilation réussit, ouvre NTE Tracker v1.1 et clique **Check Updates**. L'updater doit proposer v1.2.0. Laisse-lui créer la sauvegarde avant l'installation, puis vérifie tes données après redémarrage.

**Si le workflow est rouge, n'installe rien.** Transmets uniquement le message d'erreur (sans secrets) pour correction. Si l'updater ne détecte rien, vérifie que `v1.2.0` figure bien dans GitHub Releases avec `latest.json` et `.sig`.

### Important sur les images

Les sources de portraits sont des images de tiers (site NTE et Prydwen). Nous ne les redistribuons pas dans cette release. Leur disponibilité et les autorisations d'affichage distant ne sont pas garanties : certains portraits peuvent être absents, et les URL peuvent changer. Pour un résultat 100% hors ligne, ajoute manuellement des portraits via **Edit Profile / Photo** (stockés dans SQLite/portraits et inclus dans les backups). Une connexion Internet n'est nécessaire que pour les portraits distants et les recherches de mises à jour, pas pour ton suivi local.

### Tests exécutés dans cet environnement

- `node test-ui.cjs` : tests de l'interface avec backend SQLite simulé.
- `node test-updater.cjs` : scénarios updater et sauvegarde avec mocks.
- Compilation Windows, vérification réseau des 24 URLs et installation d'une version signée : **non effectuées ici**. C'est le workflow GitHub et le test dans l'application qui valideront ces dernières étapes.
