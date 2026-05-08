import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({
  type: "*/*"
}));

/* =========================
   CONFIG TOKEN (SAFE)
========================= */
const TOKEN = process.env.PAGSEGURO_TOKEN;

if (!TOKEN) {
  console.error("❌ PAGSEGURO_TOKEN não configurado");
  process.exit(1);
}

/* =========================
   MEMÓRIA TEMPORÁRIA
========================= */
const reads = {};

/* =========================
   CRIAR PAGAMENTO PIX
========================= */
app.post("/criar-pagamento", async (req, res) => {
  try {
    console.log("🔥 CRIAR PIX");

    const { total = 500, referencia, cliente } = req.body;

    const body = {
      reference_id: referencia || Date.now().toString(),
      customer: {
        name: cliente?.nome || "Comprador Teste",
        email: cliente?.email || "teste@teste.com",
        tax_id: cliente?.cpf || "12345678909"
      },
      items: [
        {
          name: "Consulta Oráculo",
          quantity: 1,
          unit_amount: Math.round(total)
        }
      ],
      qr_codes: [
        {
          amount: {
            value: Math.round(total)
          }
        }
      ],
      notification_urls: [
        "https://oraculo-backend-spif.onrender.com/webhook-pagseguro"
      ]
    };

    console.log("===== PAGSEGURO REQUEST =====");
    console.log(JSON.stringify(body, null, 2));

    const response = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log("===== PAGSEGURO RESPONSE =====");
    console.log(JSON.stringify(data, null, 2));

    if (!data.id) {
      console.error("❌ ERRO PAGSEGURO:", data);
      return res.status(500).json({ error: "Erro ao criar pagamento" });
    }

    reads[data.id] = { paid: false };

    const qr = data.qr_codes?.[0];

    const pixCode =
  qr?.text ||
  qr?.links?.find(l => l.rel === "QRCODE.BASE64")?.href ||
  null;

    const qrCodeImage =
      qr?.links?.find(l => l.rel === "QRCODE.PNG")?.href ||
      null;

    res.json({
      orderId: data.id,
      pixCode,
      qrCodeImage
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

/* =========================
   WEBHOOK PAGSEGURO
========================= */
app.post("/webhook-pagseguro", (req, res) => {

  try {

    console.log("🔥 WEBHOOK RECEBIDO");
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    // 🔥 pega charge corretamente
    const charge = body?.charges?.[0];

    if (!charge) {
      console.log("⚠️ WEBHOOK IGNORADO (sem charge)");
      return res.sendStatus(200);
    }

    // 🔥 pega dados corretos
    const status = charge.status;
    const metodo = charge.payment_method?.type;

    // 🔥 O ID REAL DA LEITURA
    const referenceId = charge.reference_id;

    // ✅ SOMENTE PIX PAGO
    if (status === "PAID" && metodo === "PIX") {

      if (reads[referenceId]) {

        reads[referenceId].paid = true;

        console.log("✅ PAGAMENTO CONFIRMADO REAL:", referenceId);

      } else {

        console.log("⚠️ LEITURA NÃO EXISTE:", referenceId);

      }

    } else {

      console.log("⚠️ IGNORADO:", status, metodo);

    }

    res.sendStatus(200);

  } catch (err) {

    console.error(err);
    res.sendStatus(500);

  }

});
/* =========================
   CONTROLE DE ACESSO
========================= */
app.post("/check-read", (req, res) => {
  const { readId } = req.body;

  // 🚫 sem ID ou inexistente = nunca libera
  if (!readId || !reads[readId]) {
    return res.json({ valid: false });
  }

  return res.json({ valid: reads[readId].paid === true });
});

app.post("/use-read", (req, res) => {
  const { readId } = req.body;

  if (reads[readId]) {
    delete reads[readId];
  }

  res.json({ ok: true });
});

/* =========================
   TESTE PAGSEGURO
========================= */
app.get("/teste-pagbank", async (req, res) => {
  try {
    console.log("🔥 TESTE PAGBANK");

    const body = {
      reference_id: Date.now().toString(),

      customer: {
        name: "Comprador Teste",
        email: "teste@teste.com",
        tax_id: "12345678909"
      },

      items: [
        {
          name: "Consulta Oráculo",
          quantity: 1,
          unit_amount: 500
        }
      ],

      qr_codes: [
        {
          amount: {
            value: 500
          }
        }
      ],

      notification_urls: [
        "https://oraculo-backend-spif.onrender.com/webhook-pagseguro"
      ]
    };

    const response = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no teste" });
  }
});
/* =========================
   GERAR LEITURA REAL
========================= */

const cards = [
{nome:"O Louco",img:"img/louco.jpg",luz:"Um chamado para abandonar o controle e atravessar o desconhecido. Um novo ciclo se inicia, exigindo fé no invisível.",sombra:"Impulsividade, imprudência ou fuga da realidade. Caminhar sem consciência das consequências."},
{nome:"O Mago",img:"img/mago.jpg",luz:"Você possui os recursos necessários para manifestar sua realidade. Ação consciente e intenção alinhada criam resultados.",sombra:"Manipulação, ilusão ou uso indevido do poder pessoal."},
{nome:"A Sacerdotisa",img:"img/sacerdotisa.jpg",luz:"A resposta está dentro. Silêncio, intuição e percepção além do óbvio revelam o caminho.",sombra:"Negação da intuição ou bloqueio emocional interno."},
{nome:"A Imperatriz",img:"img/imperatriz.jpg",luz:"Crescimento, fertilidade e criação. Algo está florescendo em sua vida.",sombra:"Excesso, apego ao conforto ou estagnação no prazer."},
{nome:"O Imperador",img:"img/imperador.jpg",luz:"Estrutura, liderança e estabilidade. É hora de assumir controle e responsabilidade.",sombra:"Rigidez, autoritarismo ou necessidade de controle excessivo."},
{nome:"O Hierofante",img:"img/hierofante.jpg",luz:"Aprendizado através de tradições e ensinamentos. Um guia pode surgir.",sombra:"Dogmas, crenças limitantes ou submissão cega."},
{nome:"Os Enamorados",img:"img/enamorados.jpg",luz:"Escolhas alinhadas ao coração. União e conexão verdadeira.",sombra:"Dúvida, conflito interno ou decisões baseadas em medo."},
{nome:"O Carro",img:"img/carro.jpg",luz:"Avanço, conquista e direção clara. Movimento decidido.",sombra:"Falta de controle, pressa ou caminho sem direção."},
{nome:"A Força",img:"img/forca.jpg",luz:"Domínio emocional e coragem interior. Força gentil.",sombra:"Explosões emocionais ou repressão de sentimentos."},
{nome:"O Eremita",img:"img/eremita.jpg",luz:"Busca interior, sabedoria e introspecção.",sombra:"Isolamento, solidão ou fuga do mundo."},
{nome:"Roda da Fortuna",img:"img/roda.jpg",luz:"Mudanças inevitáveis. Um novo ciclo está em movimento.",sombra:"Instabilidade, falta de controle sobre os acontecimentos."},
{nome:"Justiça",img:"img/justica.jpg",luz:"Equilíbrio, verdade e responsabilidade pelas próprias ações.",sombra:"Injustiça, desequilíbrio ou julgamento equivocado."},
{nome:"O Enforcado",img:"img/enforcado.jpg",luz:"Nova perspectiva, entrega e pausa necessária.",sombra:"Estagnação, resistência à mudança ou vitimização."},
{nome:"A Morte",img:"img/morte.jpg",luz:"Transformação profunda. Fim necessário para um novo começo.",sombra:"Resistência à mudança ou apego ao passado."},
{nome:"Temperança",img:"img/temperanca.jpg",luz:"Harmonia, equilíbrio e integração.",sombra:"Desequilíbrio, excesso ou falta de alinhamento."},
{nome:"O Diabo",img:"img/diabo.jpg",luz:"Consciência das próprias sombras e libertação através da verdade.",sombra:"Aprisionamento, vícios ou dependências emocionais."},
{nome:"A Torre",img:"img/torre.jpg",luz:"Ruptura necessária. Verdades sendo reveladas.",sombra:"Colapso, perda ou choque inesperado."},
{nome:"A Estrela",img:"img/estrela.jpg",luz:"Esperança, cura e renovação espiritual.",sombra:"Desânimo, perda de fé ou desconexão interior."},
{nome:"A Lua",img:"img/lua.jpg",luz:"Intuição profunda, mistério e sensibilidade.",sombra:"Confusão, ilusões ou medo do desconhecido."},
{nome:"O Sol",img:"img/sol.jpg",luz:"Clareza, alegria e sucesso.",sombra:"Ego inflado ou excesso de confiança."},
{nome:"O Julgamento",img:"img/julgamento.jpg",luz:"Despertar, renascimento e chamado interior.",sombra:"Negação, arrependimento ou falta de ação."},
{nome:"O Mundo",img:"img/mundo.jpg",luz:"Conclusão, realização e integração total.",sombra:"Ciclo incompleto ou sensação de vazio mesmo após conquistas."}
];

function shuffle(arr){
  return arr.sort(() => Math.random() - 0.5);
}

app.post("/gerar-leitura", (req, res) => {

  const { readId } = req.body;

  // 🔒 só libera se pagamento confirmado
  if (!readId || !reads[readId] || reads[readId].paid !== true) {
    return res.status(403).json({
      error: "Pagamento não confirmado"
    });
  }

  const tiragem = shuffle([...cards]).slice(0,10);

  const resultado = tiragem.map(carta => {

    const invertida = Math.random() < 0.5;

    return {
      nome: carta.nome,
      img: carta.img,
      invertida,
      texto: invertida ? carta.sombra : carta.luz
    };
  });

  res.json(resultado);
});
/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
