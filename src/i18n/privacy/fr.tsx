import type { PrivacyDoc } from "./types";
import DataList from "./DataList";

const fr: PrivacyDoc = {
  title: "Confidentialité et conditions des photos",
  onThisPage: "Sur cette page",
  version: (v, date) => `Version ${v} · Mise à jour le ${date}`,
  contactLabel: "Contact",
  sections: ({ L, mail, del, report, controller, reportResolvedDays, reportMaxDays, auditDays }) => [
    { id: "summary", title: "En bref", body: (
      <ul>
        <li>Nous n’utilisons que ce que vous envoyez (formulaire, photos et, sur les boards qui l’autorisent, une vidéo) pour l’examiner et, si un modérateur l’approuve, le montrer en direct.</li>
        <li>Votre e-mail n’est jamais montré en live.</li>
        <li>Le live est public : une fois montrées, les copies faites par d’autres ne peuvent pas être entièrement supprimées.</li>
        <li>Vous pouvez supprimer votre envoi à tout moment avec votre code de suppression ; sinon, il est supprimé après {L.retentionDays} jours.</li>
        <li>Réservé aux {L.minAge} ans et plus. Ni pistage, ni publicité, ni vente de données, ni entraînement d’IA.</li>
      </ul>
    )},
    { id: "controller", title: "1. Responsable", body: <p>Le responsable du traitement est {controller}.</p> },
    { id: "data", title: "2. Données traitées, finalités et durées", body: (
      <>
        <DataList
          labels={{ what: "Données", why: "Finalité", basis: "Base légale", kept: "Durée" }}
          items={[
            {
              id: "submissions",
              title: "Votre envoi",
              what: <>Pseudo, e-mail, pays, description, le board choisi, vos photos et, sur les boards qui l’autorisent, une vidéo. Les données de localisation et de l’appareil sont supprimées dans votre navigateur ; les vidéos y sont aussi compressées et envoyées sans le son.</>,
              why: "L’examiner et, s’il est approuvé, le montrer en live. L’e-mail sert uniquement à vous contacter à son sujet.",
              basis: "Votre consentement (art. 6.1.a du RGPD), que vous pouvez retirer à tout moment.",
              kept: <><strong>{L.retentionDays} jours</strong>, ou jusqu’à sa suppression par vous ou un modérateur. Envois incomplets : 24 heures.</>,
            },
            {
              title: "Preuve du consentement",
              what: "Date et heure, version de cette politique et un hachage irréversible de votre code de suppression.",
              why: "Prouver ce que vous avez accepté et vous permettre de supprimer votre envoi sans compte.",
              basis: "Obligation légale de démontrer le consentement (art. 6.1.c et 7.1).",
              kept: "Aussi longtemps que l’envoi.",
            },
            {
              id: "reports",
              title: "Signalements de problèmes",
              what: "Catégorie, message, la page ou le board d’origine, votre langue et, seulement si vous l’indiquez, un e-mail.",
              why: "Corriger les défauts, retirer les contenus inappropriés et, si vous l’avez demandé, vous répondre.",
              basis: "Intérêt légitime (art. 6.1.f) ; la réponse, votre consentement.",
              kept: `${reportResolvedDays} jours après leur résolution, et jamais plus de ${reportMaxDays} jours.`,
            },
            {
              title: "Sécurité",
              what: "Votre adresse IP, conservée uniquement sous forme de hachage irréversible avec clé, et les signaux du navigateur vérifiés par Cloudflare Turnstile.",
              why: "Bloquer le spam, les robots et les attaques (limites de tentatives et vérification anti-robots).",
              basis: "Intérêt légitime à sécuriser le service (art. 6.1.f).",
              kept: "Compteurs de tentatives : 48 heures.",
            },
            {
              id: "streamers",
              title: "Comptes streamer (Twitch)",
              what: <>Uniquement pour les streamers : votre identifiant, login et nom Twitch, le lien vers votre photo de profil, le statut de votre compte et vos dates de connexion, et les Admins de votre équipe. Nous ne recevons ni votre e-mail ni votre mot de passe Twitch, et nous ne gardons aucun jeton Twitch.</>,
              why: "Confirmer que vous êtes bien le streamer, afficher votre page publique et vos boards, et gérer qui peut vous aider.",
              basis: "Fourniture du service que vous demandez (art. 6.1.b) et notre intérêt légitime à empêcher l’usurpation d’identité (art. 6.1.f).",
              kept: "Tant que votre compte existe. Les demandes non validées sont supprimées après 30 jours.",
            },
            {
              id: "staff",
              title: "Comptes de l’équipe et journal d’activité",
              what: <>Pour les administrateurs : identifiant, rôle, un hachage du mot de passe, la clé chiffrée de la validation en deux étapes et la dernière connexion. Un <strong>journal d’activité</strong> enregistre qui a fait quoi et quand (connexions, approbations, suppressions, modifications des boards et des comptes) avec un identifiant de connexion pseudonymisé. Il ne contient jamais de données des personnes qui envoient.</>,
              why: "Gérer les accès, détecter les abus et pouvoir démontrer comment les données ont été traitées.",
              basis: "Intérêt légitime et obligation de sécurité (art. 5.2, 6.1.f et 32).",
              kept: `Comptes : tant que la personne fait partie de l’équipe. Journal d’activité : ${auditDays} jours ; les entrées ne peuvent pas être modifiées.`,
            },
          ]}
        />
        <p>N’incluez rien qui révèle la santé, la religion, les opinions politiques, l’orientation sexuelle ou similaire (art. 9) ; si une photo le montre, nous la supprimons ou considérons que vous l’avez rendu public à cette fin. La modération est faite par des personnes : ni décision automatisée ni profilage.</p>
      </>
    )},
    { id: "photos", title: "3. Conditions des photos et de la diffusion", body: (
      <ul>
        <li>N’envoyez que des photos que vous avez prises ou dont vous détenez les droits, et que vous êtes autorisé à partager.</li>
        <li>Personne sur les photos, sauf sur les boards qui l’autorisent (comme les reviews de cosplay) : seulement vous ou des adultes ayant accepté d’apparaître. <strong>Jamais d’enfants.</strong></li>
        <li>Vous accordez à {L.controllerName} et <strong>au streamer indiqué sur le board</strong> une licence gratuite, non exclusive et révocable à tout moment pour montrer les photos et la vidéo, le pseudo, le pays et la description <strong>pendant les lives de ce streamer</strong>, ses rediffusions et extraits. Rien d’autre : ni vente, ni publicité, ni autre publication, ni entraînement d’IA.</li>
        <li>Les modérateurs peuvent refuser, supprimer, flouter ou passer toute photo pour protéger la vie privée.</li>
        <li>Tout le monde peut regarder, enregistrer et découper le live. Si vous retirez votre consentement, nous arrêtons de montrer vos photos et supprimons les enregistrements et extraits que nous contrôlons lorsque la plateforme le permet ; nous ne pouvons pas supprimer les copies faites par d’autres.</li>
      </ul>
    )},
    { id: "recipients", title: "4. Qui peut voir vos données", body: (
      <ul>
        <li><strong>L’équipe du board</strong> : l’équipe du streamer (jusqu’à deux Admins qu’il choisit), l’admin qui a créé le board, les admins avec qui il est partagé et ses Board Admins (modérateurs avec le mot de passe de la file). Ils voient tout, mais uniquement pour ce board.</li>
        <li><strong>Les Site Admins</strong> (qui gèrent le site) : tous les boards, les signalements et le journal d’activité.</li>
        <li><strong>Le streamer</strong> : photos et vidéos approuvées, pseudo, pays et description de son board. Jamais votre e-mail. Les streamers ne voient pas la file.</li>
        <li><strong>Le public du live</strong> : la même chose, uniquement après approbation.</li>
        <li><strong>Tout le monde</strong>, uniquement pour les streamers : votre page publique affiche votre nom Twitch, votre photo de profil et vos boards actifs, et l’on peut vous trouver dans la recherche.</li>
        <li><strong>Twitch</strong> (Twitch Interactive, Inc.), uniquement quand un streamer se connecte avec Twitch : Twitch gère cette connexion selon sa propre politique de confidentialité et nous indique qui vous êtes.</li>
        <li><strong>Prestataires</strong> travaillant pour nous dans le cadre de contrats de sous-traitance : Supabase (base de données et photos, région {L.databaseRegion}), Vercel (hébergement, journaux techniques de courte durée) et Cloudflare (vérification anti-robots). Lorsqu’ils accèdent aux données depuis les États-Unis, les transferts sont encadrés par le Cadre de protection des données UE–États-Unis et/ou des clauses contractuelles types (art. 45 et 46).</li>
        <li>Les autorités, uniquement si la loi l’exige.</li>
      </ul>
    )},
    { id: "rights", title: "5. Vos droits", body: (
      <>
        <p>Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter l’usage ou vous y opposer, en obtenir une copie (portabilité) et retirer votre consentement.</p>
        <ul>
          <li><strong>Le plus rapide :</strong> {del("supprimer votre envoi")} avec votre code de suppression.</li>
          <li><strong>Toute autre demande</strong> ou code perdu : écrivez à {mail} depuis l’adresse utilisée. Nous répondons sous un mois.</li>
          <li>Pour signaler une photo ou un contenu vous concernant : {report("signaler un problème")}.</li>
          <li>Vous pouvez porter plainte auprès d’une autorité de protection des données : en Espagne l’<a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, en France la CNIL, ou celle du lieu où vous vivez ou travaillez.</li>
        </ul>
        <p>Ces droits s’appliquent où que vous viviez (y compris au titre du RGPD britannique, de la LGPD brésilienne et des lois américaines comme la CCPA/CPRA). Nous ne vendons ni ne partageons de données personnelles à des fins publicitaires.</p>
      </>
    )},
    { id: "cookies", title: "6. Cookies", body: (
      <>
        <p>Uniquement des cookies strictement nécessaires ou que vous demandez, d’où l’absence de bandeau de consentement :</p>
        <ul>
          <li>Les cookies de sécurité de Cloudflare Turnstile, sur les formulaires avec vérification anti-robots.</li>
          <li>Session de l’équipe (12 heures) et étape de validation en deux étapes (5 minutes).</li>
          <li>Vérification de la connexion avec Twitch (10 minutes), uniquement pendant qu’un streamer se connecte avec Twitch.</li>
          <li>Langue (1 an), seulement si vous en choisissez une dans le menu.</li>
        </ul>
        <p>Le thème de couleur est enregistré dans votre navigateur et ne nous est jamais envoyé.</p>
      </>
    )},
    { id: "security", title: "7. Sécurité", body: (
      <p>Les photos et les vidéos sont dans un stockage privé et ne sont affichées que par des liens temporaires. Seuls les Site Admins créent des comptes d’équipe, et chaque streamer peut ajouter jusqu’à deux Admins à sa propre équipe ; l’équipe utilise des mots de passe robustes hachés et la validation en deux étapes (obligatoire pour l’Owner). Les streamers se connectent avec Twitch et doivent être validés avant de créer des boards. Chaque board a des mots de passe distincts pour sa file et son deck, régénérables à tout moment pour révoquer l’accès. Le trafic est chiffré (HTTPS), les connexions sont protégées contre les robots et la force brute, et seul notre serveur accède à la base de données.</p>
    )},
    { id: "minors", title: "8. Âge minimum", body: (
      <p>Vous devez avoir {L.minAge} ans ou plus pour envoyer. Si nous apprenons qu’un envoi provient d’un mineur ou en montre un, nous le supprimons.</p>
    )},
    { id: "changes", title: "9. Modifications", body: (
      <p>Si nous modifions cette politique, nous mettons à jour la version et la date ci-dessus. Chaque envoi enregistre la version acceptée.</p>
    )},
  ],
};

export default fr;
