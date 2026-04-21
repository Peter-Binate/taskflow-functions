import { Resend } from 'resend';

const resend = new Resend('re_HQuHjRV7_BvrLnzeTa72HGcF6PwM7zqt4'); // La clé de l'environnement

async function testMail() {
  try {
    const data = await resend.emails.send({
      from: 'TaskFlow <onboarding@resend.dev>', // Email test autorisé par Resend
      to: ['laihemamine@gmail.com'], // Email du destinataire
      subject: '[TaskFlow] Test envoi de mail',
      html: '<h2>Bonjour!</h2><p>Ceci est un test direct via l\'API de Resend pour valider l\'envoi des mails.</p>',
    });

    console.log('✅ Email envoyé avec succès:', data);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error);
  }
}

testMail();
