import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

// 🔥 IMPORTANTE: isso aqui estava te quebrando o webhook
app.use(express.json({ type: "*/*" }));

/* =========================
   TOKEN
========================= */
const TOKEN = process.env.PAGSEGURO_TOKEN;

if (!TOKEN) {
  console.error("❌ PAGSEGURO_TOKEN não configurado");
  process.exit(1);
}

/* =========================
   MEMÓRIA
========================= */
const reads = {};

/* =========================
   CRIAR PAGAMENTO
========================= */
app.post("/criar-pagamento", async (req, res) => {
  try {

    const { total = 500, referencia, cliente } = req.body;

    const referenceId = referencia || Date.now().toString();

    const body = {
      reference_id: referenceId,
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
          amount: { value: Math.round(total) }
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

    if (!data.id) {
      return res.status(500).json({ error: "Erro PagSeguro" });
    }

    // 🔥 AQUI ESTÁ A CORREÇÃO PRINCIPAL
    reads[referenceId] = {
      paid: false,
      used: false,
      orderId: data.id
    };

    const qr = data.qr_codes?.[0];

    res.json({
      orderId: referenceId, // 🔥 importante: AGORA o frontend usa isso
      pixCode:
        qr?.text ||
        qr?.links?.find(l => l.rel === "QRCODE.BASE64")?.href,
      qrCodeImage:
        qr?.links?.find(l => l.rel === "QRCODE.PNG")?.href
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

/* =========================
   WEBHOOK (CORRIGIDO DE VERDADE)
========================= */
app.post("/webhook-pagseguro", (req, res) => {

  try {

    console.log("🔥 WEBHOOK RECEBIDO");
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    // 🔥 tenta vários formatos reais do PagBank
    const charge =
      body?.charges?.[0] ||
      body?.acusações?.[0] ||
      body?.charge ||
      body;

    const status = charge?.status;
    const metodo = charge?.payment_method?.type;

    // 🔥 pega reference ID de forma robusta
    const referenceId =
      charge?.reference_id ||
      body?.reference_id ||
      body?.id ||
      body?.metadata?.reference_id;

    if (!referenceId) {
      console.log("⚠️ SEM REFERENCE_ID");
      return res.sendStatus(200);
    }

    if (status === "PAID" && metodo === "PIX") {

      if (reads[referenceId]) {

        reads[referenceId].paid = true;

        console.log("✅ PAGAMENTO CONFIRMADO:", referenceId);

      } else {
        console.log("⚠️ NÃO ENCONTROU LEITURA:", referenceId);
      }

    } else {
      console.log("⚠️ IGNORADO:", status, metodo);
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    res.sendStatus(200);
  }

});

/* =========================
   CHECK
========================= */
app.post("/check-read", (req, res) => {

  const { readId } = req.body;

  if (!readId || !reads[readId]) {
    return res.json({ valid: false });
  }

  return res.json({ valid: reads[readId].paid === true });
});

/* =========================
   USE READ
========================= */
app.post("/use-read", (req, res) => {

  const { readId } = req.body;

  if (reads[readId]) {
    delete reads[readId];
  }

  res.json({ ok: true });
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
