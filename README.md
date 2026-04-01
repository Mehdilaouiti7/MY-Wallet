MY Wallet

Deploiement Vercel (avec backend email)

Le frontend est statique et le backend est une Serverless Function Vercel:
- `api/send-reminders.js`

Cette API:
- lit les echeances a venir (7 jours) dans Supabase
- lit l'email enregistre dans `app_config.key = email_rappel`
- envoie un email reel via Resend

Variables d'environnement Vercel obligatoires

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (recommande) ou `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL` (ex: `MY Wallet <onboarding@resend.dev>` ou domaine verifie)

Variables optionnelles

- `REMINDER_TO_EMAIL` (force une adresse de destination fixe)
- `ALLOW_ORIGIN` (sinon `*`)

Etapes de deploiement

1. Importer ce dossier dans Vercel.
2. Dans Project Settings > Environment Variables, ajouter toutes les variables ci-dessus.
3. Redeployer.
4. Ouvrir l'app, enregistrer ton email dans Reglages.
5. Cliquer sur "Declencher les rappels".

Verifier rapidement

- Endpoint: `/api/send-reminders`
- Endpoint diagnostic: `/api/email-status`
- Reponse attendue:
	- succes: `{ "ok": true, "sent": 1, "echeances": <n>, "recipient": "..." }`
	- aucune echeance: `{ "ok": true, "sent": 0, "echeances": 0, "recipient": "..." }`

Diagnostic email

- Le bouton "Diagnostic email" dans l'app appelle `/api/email-status`.
- Il verifie la presence des variables critiques:
	- `SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY`
	- `RESEND_API_KEY`
	- `REMINDER_FROM_EMAIL`

Notes importantes

- Si `ok: true` mais aucun email recu:
	- verifier le statut du mail dans Resend Logs
	- verifier que `REMINDER_FROM_EMAIL` est autorise par Resend
	- verifier la reputation/deliverability du domaine expediteur
