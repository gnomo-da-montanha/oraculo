import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 armazenar pagamentos liberados
let reads = {};

/* =========================
   CRIAR PAGAMENTO (PIX)
========================= */
app.post("/criar-pagamento", (req, res) => {

  const referenceId = Date.now().toString();

  // ⚠️ AQUI NÃO libera ainda
  // só gera o pagamento

  res.json({
    readId: referenceId,
    pix: "PIX TESTE 123",
    qr: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TESTE"
  });

});

/* =========================
   CONFIRMAR PAGAMENTO (BOTÃO "JÁ PAGUEI")
========================= */
app.post("/confirmar-pagamento", (req, res) => {

  const { readId } = req.body;

  if(!readId){
    return res.json({ ok: false });
  }

  // 🔥 AGORA SIM libera a leitura
  reads[readId] = { used: false };

  res.json({ ok: true });
});

/* =========================
   PAGAMENTO CONFIRMADO (LEGADO)
========================= */
app.post("/payment-confirmed", (req, res) => {
  const id = Date.now().toString();

  reads[id] = { used: false };

  res.json({ readId: id });
});

/* =========================
   VERIFICAR LEITURA
========================= */
app.post("/check-read", (req, res) => {
  const { readId } = req.body;

  const read = reads[readId];

  if (!read) return res.json({ valid: false });

  if (read.used) return res.json({ valid: false });

  res.json({ valid: true });
});

/* =========================
   CONSUMIR LEITURA
========================= */
app.post("/use-read", (req, res) => {
  const { readId } = req.body;

  if (reads[readId]) {
    reads[readId].used = true;
  }

  res.json({ ok: true });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
