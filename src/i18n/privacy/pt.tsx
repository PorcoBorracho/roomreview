import type { PrivacyDoc } from "./types";
import DataList from "./DataList";

const pt: PrivacyDoc = {
  title: "Privacidade e termos das fotos",
  onThisPage: "Nesta página",
  version: (v, date) => `Versão ${v} · Atualizada em ${date}`,
  contactLabel: "Contato",
  sections: ({ L, mail, del, report, controller, reportResolvedDays, reportMaxDays, auditDays }) => [
    { id: "summary", title: "Em resumo", body: (
      <ul>
        <li>Só usamos o que você envia (formulário, fotos e, nos boards que permitem, um vídeo) para avaliar e, se um moderador aprovar, mostrar ao vivo.</li>
        <li>Seu e-mail nunca aparece na live.</li>
        <li>A live é pública: depois de mostrado, não é possível remover totalmente cópias feitas por outras pessoas.</li>
        <li>Você pode apagar seu envio a qualquer momento com o código de exclusão; caso contrário, ele é apagado após {L.retentionDays} dias.</li>
        <li>Somente maiores de {L.minAge} anos. Sem rastreamento, anúncios, venda de dados ou treinamento de IA.</li>
      </ul>
    )},
    { id: "controller", title: "1. Responsável", body: <p>O controlador dos dados é {controller}.</p> },
    { id: "data", title: "2. Quais dados tratamos, para quê e por quanto tempo", body: (
      <>
        <DataList
          labels={{ what: "Dados", why: "Finalidade", basis: "Base legal", kept: "Prazo" }}
          items={[
            {
              id: "submissions",
              title: "Seu envio",
              what: <>Usuário, e-mail, país, descrição, o board escolhido, suas fotos e, nos boards que permitem, um vídeo. Os dados de localização e da câmera são removidos no seu navegador; os vídeos também são comprimidos ali e enviados sem som.</>,
              why: "Analisar e, se aprovado, mostrar na live. O e-mail serve apenas para entrar em contato sobre o envio.",
              basis: "Seu consentimento (art. 6(1)(a) do RGPD; art. 7, I, da LGPD), que você pode revogar a qualquer momento.",
              kept: <><strong>{L.retentionDays} dias</strong>, ou até você ou um moderador apagar. Envios incompletos: 24 horas.</>,
            },
            {
              title: "Prova do consentimento",
              what: "Data e hora, versão desta política e um hash irreversível do seu código de exclusão.",
              why: "Comprovar o que você aceitou e permitir que você apague seu envio sem conta.",
              basis: "Obrigação legal de comprovar o consentimento (arts. 6(1)(c) e 7(1)).",
              kept: "O mesmo prazo do envio.",
            },
            {
              id: "reports",
              title: "Relatos de problemas",
              what: "Categoria, mensagem, a página ou board de onde foi enviado, seu idioma e, somente se você informar, um e-mail.",
              why: "Corrigir falhas, remover conteúdo inadequado e, se você pediu, responder.",
              basis: "Interesse legítimo (art. 6(1)(f)); a resposta, seu consentimento.",
              kept: `${reportResolvedDays} dias após a resolução, e nunca mais de ${reportMaxDays} dias.`,
            },
            {
              title: "Segurança",
              what: "Seu endereço IP, guardado apenas como hash irreversível com chave, e os sinais do navegador verificados pelo Cloudflare Turnstile.",
              why: "Impedir spam, bots e ataques (limites de tentativas e verificação antibots).",
              basis: "Interesse legítimo em manter o serviço seguro (art. 6(1)(f)).",
              kept: "Contadores de tentativas: 48 horas.",
            },
            {
              id: "streamers",
              title: "Contas de streamer (Twitch)",
              what: <>Somente dos streamers: seu ID de usuário, login e nome na Twitch, o link da sua foto de perfil, o status da conta e as datas de acesso, e os Admins da sua equipe. Não recebemos seu e-mail nem sua senha da Twitch, e não guardamos nenhum token da Twitch.</>,
              why: "Confirmar que você é o streamer, mostrar sua página pública e seus boards, e gerenciar quem pode ajudar você.",
              basis: "Prestação do serviço que você pede (art. 6(1)(b)) e nosso interesse legítimo em evitar falsificação de identidade (art. 6(1)(f)).",
              kept: "Enquanto sua conta existir. Pedidos não aprovados são excluídos após 30 dias.",
            },
            {
              id: "staff",
              title: "Contas da equipe e registro de atividade",
              what: <>Dos administradores: usuário, função, um hash da senha, a chave criptografada do 2FA e o último login. Um <strong>registro de atividade</strong> anota quem fez o quê e quando (logins, aprovações, exclusões, mudanças em boards e contas) com um identificador de conexão pseudonimizado. Nunca inclui dados de quem envia.</>,
              why: "Gerenciar acessos, detectar usos indevidos e poder demonstrar como os dados foram tratados.",
              basis: "Interesse legítimo e dever de manter os dados seguros (arts. 5(2), 6(1)(f) e 32).",
              kept: `Contas: enquanto a pessoa fizer parte da equipe. Registro de atividade: ${auditDays} dias; as entradas não podem ser alteradas.`,
            },
          ]}
        />
        <p>Não inclua nada que revele saúde, religião, opiniões políticas, orientação sexual ou semelhantes (art. 9); se uma foto mostrar, nós a apagamos ou consideramos que você o tornou público para esta finalidade. A moderação é feita por pessoas: sem decisões automatizadas nem criação de perfis.</p>
      </>
    )},
    { id: "photos", title: "3. Termos das fotos e da transmissão", body: (
      <ul>
        <li>Envie apenas fotos que você tirou ou sobre as quais tem direitos, e que tem permissão para compartilhar.</li>
        <li>Sem pessoas nas fotos, exceto nos boards que permitem (como reviews de cosplay): lá, apenas você ou adultos que concordaram em aparecer. <strong>Nunca crianças.</strong></li>
        <li>Você concede a {L.controllerName} e <strong>ao streamer indicado no board</strong> uma licença gratuita, não exclusiva e revogável a qualquer momento para mostrar as fotos e o vídeo, o usuário, o país e a descrição <strong>nas lives desse streamer</strong>, nas gravações e nos destaques. Nada além disso: sem venda, publicidade, outras publicações ou treinamento de IA.</li>
        <li>Os moderadores podem rejeitar, apagar, desfocar ou pular qualquer foto para proteger a privacidade.</li>
        <li>Qualquer pessoa pode assistir, gravar e recortar a live. Se você revogar, paramos de mostrar suas fotos e apagamos as gravações e clipes que controlamos, quando a plataforma permite; não podemos apagar cópias feitas por outros.</li>
      </ul>
    )},
    { id: "recipients", title: "4. Quem pode ver seus dados", body: (
      <ul>
        <li><strong>A equipe do board</strong>: a equipe do streamer (até dois Admins escolhidos por ele), o admin que criou o board, os admins com quem foi compartilhado e seus Board Admins (moderadores com a senha da fila). Eles veem tudo, mas apenas desse board.</li>
        <li><strong>Os Site Admins</strong> (administram o site): todos os boards, os relatos e o registro de atividade.</li>
        <li><strong>O streamer</strong>: fotos e vídeos aprovados, usuário, país e descrição do board dele. Nunca seu e-mail. Os streamers não veem a fila.</li>
        <li><strong>O público da live</strong>: o mesmo, e somente após a aprovação.</li>
        <li><strong>Qualquer pessoa</strong>, apenas no caso dos streamers: sua página pública mostra seu nome da Twitch, sua foto de perfil e seus boards ativos, e você pode ser encontrado na busca.</li>
        <li><strong>Twitch</strong> (Twitch Interactive, Inc.), apenas quando um streamer entra com a Twitch: a Twitch cuida desse acesso conforme a própria política de privacidade e nos informa quem você é.</li>
        <li><strong>Prestadores</strong> que trabalham para nós com contrato de operador: Supabase (banco de dados e fotos, região {L.databaseRegion}), Vercel (hospedagem, registros técnicos de curta duração) e Cloudflare (verificação antibots). Quando acessam dos EUA, as transferências são amparadas pelo Quadro de Privacidade de Dados UE-EUA e/ou por cláusulas-padrão (arts. 45 e 46 do RGPD; art. 33 da LGPD).</li>
        <li>Autoridades, somente se a lei exigir.</li>
      </ul>
    )},
    { id: "rights", title: "5. Seus direitos", body: (
      <>
        <p>Você pode acessar, corrigir, apagar, limitar ou se opor ao uso dos seus dados, pedir uma cópia (portabilidade) e revogar o consentimento.</p>
        <ul>
          <li><strong>O mais rápido:</strong> {del("apagar seu envio")} com o código de exclusão.</li>
          <li><strong>Qualquer outra coisa</strong> ou código perdido: escreva para {mail} a partir do e-mail que usou. Respondemos em até um mês.</li>
          <li>Para avisar sobre uma foto ou conteúdo sobre você: {report("relatar um problema")}.</li>
          <li>Você pode reclamar a uma autoridade de proteção de dados: na Espanha a <a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, no Brasil a ANPD, ou a autoridade de onde você mora ou trabalha.</li>
        </ul>
        <p>Esses direitos valem onde quer que você viva (inclusive sob o RGPD do Reino Unido, a LGPD e leis estaduais dos EUA como a CCPA/CPRA). Não vendemos nem compartilhamos dados pessoais para publicidade.</p>
      </>
    )},
    { id: "cookies", title: "6. Cookies", body: (
      <>
        <p>Apenas cookies estritamente necessários ou que você pede, por isso não há banner de consentimento:</p>
        <ul>
          <li>Cookies de segurança do Cloudflare Turnstile, nos formulários com verificação antibots.</li>
          <li>Sessão da equipe (12 horas) e etapa da verificação em duas etapas (5 minutos).</li>
          <li>Verificação do login com a Twitch (10 minutos), apenas enquanto um streamer entra com a Twitch.</li>
          <li>Idioma (1 ano), somente se você escolher um no menu.</li>
        </ul>
        <p>O tema de cores é guardado no seu navegador e nunca é enviado para nós.</p>
      </>
    )},
    { id: "security", title: "7. Segurança", body: (
      <p>As fotos e os vídeos ficam em armazenamento privado e só são exibidos por links temporários. Apenas Site Admins criam contas da equipe, e cada streamer pode adicionar até dois Admins à própria equipe; a equipe usa senhas fortes guardadas com hash e verificação em duas etapas (obrigatória para o Owner). Os streamers entram com a Twitch e precisam ser aprovados antes de criar boards. Cada board tem senhas separadas para a fila e o deck, que podem ser regeneradas a qualquer momento para revogar o acesso. O tráfego é criptografado (HTTPS), os logins são protegidos contra bots e força bruta, e apenas nosso servidor acessa o banco de dados.</p>
    )},
    { id: "minors", title: "8. Idade mínima", body: (
      <p>Você precisa ter {L.minAge} anos ou mais para enviar. Se soubermos que um envio vem de um menor ou o mostra, nós o apagamos.</p>
    )},
    { id: "changes", title: "9. Alterações", body: (
      <p>Se alterarmos esta política, atualizamos a versão e a data acima. Cada envio registra a versão aceita.</p>
    )},
  ],
};

export default pt;
