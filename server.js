import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CONFIG TOKEN (SAFE)
========================= */
const TOKEN =
  process.env.PAGSEGURO_TOKEN;

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

    const { total = 1990, referencia, cliente } = req.body;

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

    // 🚫 IGNORA QUALQUER COISA VAZIA OU INVÁLIDA
    if (
      !body ||
      !body.id ||
      !body.charges ||
      !body.charges[0] ||
      !body.charges[0].status ||
      !body.charges[0].payment_method
    ) {
      console.log("⚠️ WEBHOOK IGNORADO (inválido)");
      return res.sendStatus(200);
    }

    const orderId = body.id;
    const charge = body.charges[0];

    const status = charge.status;
    const metodo = charge.payment_method?.type;

    // ✅ SOMENTE PIX PAGO DE VERDADE
    if (status === "PAID" && metodo === "PIX") {
      if (reads[orderId]) {
        reads[orderId].paid = true;
        console.log("✅ PAGAMENTO CONFIRMADO REAL:", orderId);
      } else {
        console.log("⚠️ ORDER NÃO EXISTE NO SISTEMA:", orderId);
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
          unit_amount: 1990
        }
      ],

      qr_codes: [
        {
          amount: {
            value: 1990
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
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
