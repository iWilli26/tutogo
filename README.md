# TutoGO

Suivi des séances de tutorat bénévole du CIMF. Les téléphones ne servent qu'avant et après la séance.

## Lancer

```bash
nvm use            # Node 24 (>= 22 requis)
npm install
npm run setup      # crée data/tutogo.db et les comptes de démonstration
npm run dev        # http://localhost:3000
```

Tous les comptes de démonstration ont le mot de passe `tutogo-demo` (boutons sur la page de connexion, hors production) :
Amandine, Sarah, Maya (tuteurs) · Emma, Lucas, Chloé (tutorés) · `admin@cimf.test` (admin).

En production : définir `SESSION_SECRET` (chaîne aléatoire de 32+ octets).

Vérifications : `npm run typecheck`, `npm run lint`, `npm test`.

## Parcours à tester

1. Amandine → **Préparer une séance** → Emma + matière → code à 4 caractères.
2. (tutorat sans téléphone)
3. Amandine → **Terminer une séance** → code + durée. La durée ne peut pas dépasser le temps écoulé depuis la préparation (+5 min) : en démo, attendre ~10 min après la préparation et déclarer 10 min, ou voir `tests/sessions.test.ts` qui simule le temps.
4. Emma → confirme (OUI + tranche de durée) → séance validée si les déclarations concordent.
5. Amandine : heures mises à jour. Admin : classement, anomalies, séances à vérifier.

## Architecture

Next.js (App Router) + TypeScript + Tailwind, server actions, SQLite via Drizzle (`better-sqlite3`).
SQLite plutôt que PostgreSQL pour un prototype lançable sans installation ; le schéma Drizzle se porte vers
PostgreSQL en changeant le dialecte. Les triggers d'immutabilité (`drizzle/0001_*.sql`) devront alors être réécrits en PL/pgSQL.

- `src/db/schema.ts` : Users, TutorProfiles, TuteeProfiles, Subjects, TutorTuteeRelationships, Sessions, SessionConfirmations, Anomalies, AuditLogs.
- `src/server/sessions.ts` : préparer, déclarer, confirmer, décision admin (toute la logique de confiance est ici, côté serveur).
- `src/server/detectors.ts`, `src/server/anomalies.ts`, `src/server/queries.ts` (`scanStaleSessions`) : détection d'anomalies.
- `src/server/auth/provider.ts` : interface `AuthProvider`. Seul `localPasswordProvider` (e-mail + mot de passe scrypt) existe. Aucune connexion CIMF/Google/Microsoft n'est configurée ; en ajouter une revient à implémenter `AuthProvider`.

## Règles anti-triche implémentées

- Le total d'heures n'est jamais stocké : somme des `validated_minutes` des séances `VALIDATED`.
- Le tuteur n'a pas d'action qui modifie un statut ou un total ; le code de séance n'est valable que pour son propre compte.
- Durée déclarée ≤ temps écoulé depuis la préparation (+5 min), sinon refus et anomalie.
- Validation automatique seulement si tuteur et tutoré concordent (tolérance 10 min autour de la tranche) et qu'aucune anomalie n'est ouverte. Minutes créditées = min(durée tuteur, borne haute de la tranche du tutoré).
- Triggers SQL : identité d'une séance, déclaration du tuteur et confirmations non modifiables ; journal d'audit en ajout seul ; séances non supprimables.
- Journal d'audit de la création, des déclarations, confirmations, décisions admin et anomalies.

## Limites (honnêtes)

- Deux élèves qui s'entendent peuvent déclarer une fausse séance cohérente. Le système la rend plus difficile à passer inaperçue (fréquence, chevauchements, durée trop longue, historique audité), pas impossible.
- Un tuteur peut faire valider une séance en ayant le code, puis le tutoré confirme sans être venu : seule la répétition ou un contrôle humain le révèle.
- Pas de limitation de tentatives de connexion ni de notification au tutoré (à ajouter).
- Les détecteurs `UNUSUAL_ACCOUNT` et `INSTANT_CONFIRMATION` utilisent des seuils arbitraires à ajuster avec des données réelles.

## Améliorations possibles sans alourdir l'usage

1. **Contrôles aléatoires** : l'admin tire au sort ~10 % des séances validées pour une vérification auprès d'un enseignant ou du tutoré.
2. **Signature de l'enseignant ou du surveillant** : un code à usage unique donné à l'accueil/salle de tutorat, lié à un créneau, qui prouve la présence sans téléphone.
3. **Créneaux planifiés** : séances rattachées à un créneau/une salle de l'emploi du temps ; hors créneau, la séance passe automatiquement « à vérifier ».
